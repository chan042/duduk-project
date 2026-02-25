"""
safe_formula.py

DB에 문자열로 저장된 수식을 안전하게 평가하는 유틸리티 모듈.

eval() 대신 Python AST(추상 구문 트리)를 직접 파싱·탐색하여,
허용된 연산자·함수·상수만 실행되도록 제한한다.

허용 항목:
  - 연산자: + - * / // % **
  - 비교:   == != < <= > >=
  - 논리:   and, or
  - 함수:   min, max, abs, round, int, float
  - 문법:   삼항 표현식 (a if b else c)
  - 플레이스홀더: {변수명} 형식으로 변수 주입 가능

사용 예:
    evaluate_formula("{spent} <= {target} * 1.1", {"spent": 28000, "target": 30000})
    # → True

    evaluate_formula("min({budget} - {spent}, 1000) * 0.08", {"budget": 50000, "spent": 30000})
    # → 1000.0
"""
import ast
import math
import operator
import re


class FormulaEvaluationError(ValueError):
    """수식 평가 오류."""


_PLACEHOLDER_PATTERN = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")

_BINARY_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

_COMPARE_OPS = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}

_ALLOWED_FUNCTIONS = {
    "min": min,
    "max": max,
    "abs": abs,
    "round": round,
    "int": int,
    "float": float,
}


def _replace_placeholders(expression: str, variables: dict) -> str:
    def _repl(match):
        key = match.group(1)
        if key not in variables:
            raise FormulaEvaluationError(f"Unknown placeholder: {key}")
        return str(variables[key])

    return _PLACEHOLDER_PATTERN.sub(_repl, expression)


class _SafeFormulaEvaluator(ast.NodeVisitor):
    def __init__(self, variables):
        self.variables = variables or {}

    def visit_Expression(self, node):
        return self.visit(node.body)

    def visit_Constant(self, node):
        if isinstance(node.value, (int, float, bool)):
            return node.value
        raise FormulaEvaluationError(f"Unsupported constant: {node.value!r}")

    def visit_Name(self, node):
        if node.id in self.variables:
            return self.variables[node.id]
        if node.id in _ALLOWED_FUNCTIONS:
            return _ALLOWED_FUNCTIONS[node.id]
        raise FormulaEvaluationError(f"Unknown identifier: {node.id}")

    def visit_BinOp(self, node):
        op = _BINARY_OPS.get(type(node.op))
        if not op:
            raise FormulaEvaluationError(f"Unsupported operator: {type(node.op).__name__}")
        return op(self.visit(node.left), self.visit(node.right))

    def visit_UnaryOp(self, node):
        op = _UNARY_OPS.get(type(node.op))
        if not op:
            raise FormulaEvaluationError(f"Unsupported unary operator: {type(node.op).__name__}")
        return op(self.visit(node.operand))

    def visit_Compare(self, node):
        left = self.visit(node.left)
        for op_node, comparator in zip(node.ops, node.comparators):
            op = _COMPARE_OPS.get(type(op_node))
            if not op:
                raise FormulaEvaluationError(f"Unsupported comparison: {type(op_node).__name__}")
            right = self.visit(comparator)
            if not op(left, right):
                return False
            left = right
        return True

    def visit_BoolOp(self, node):
        values = [self.visit(value) for value in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        if isinstance(node.op, ast.Or):
            return any(values)
        raise FormulaEvaluationError(f"Unsupported boolean operator: {type(node.op).__name__}")

    def visit_IfExp(self, node):
        return self.visit(node.body) if self.visit(node.test) else self.visit(node.orelse)

    def visit_Call(self, node):
        if node.keywords:
            raise FormulaEvaluationError("Keyword arguments are not allowed.")
        if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCTIONS:
            raise FormulaEvaluationError("Function is not allowed.")
        func = _ALLOWED_FUNCTIONS[node.func.id]
        args = [self.visit(arg) for arg in node.args]
        return func(*args)

    def generic_visit(self, node):
        raise FormulaEvaluationError(f"Unsupported syntax: {type(node).__name__}")


def evaluate_formula(expression: str, variables: dict) -> float:
    if not isinstance(expression, str) or not expression.strip():
        raise FormulaEvaluationError("Expression must be a non-empty string.")

    normalized = _replace_placeholders(expression, variables)

    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError as exc:
        raise FormulaEvaluationError(f"Invalid expression syntax: {normalized!r}") from exc

    try:
        result = _SafeFormulaEvaluator(variables).visit(tree)
    except ZeroDivisionError as exc:
        raise FormulaEvaluationError("Division by zero.") from exc
    except OverflowError as exc:
        raise FormulaEvaluationError("Numeric overflow.") from exc

    if isinstance(result, bool):
        result = int(result)
    if not isinstance(result, (int, float)) or not math.isfinite(result):
        raise FormulaEvaluationError("Result must be a finite number.")

    return result
