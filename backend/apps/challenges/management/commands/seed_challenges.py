from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Seed Duduk challenge templates into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-update",
            action="store_true",
            help="Update existing templates as well (overwrite fields).",
        )

    def handle(self, *args, **options):
        from apps.challenges.seed_challenges import seed_challenge_templates

        result = seed_challenge_templates(force_update=options["force_update"])

        self.stdout.write(self.style.SUCCESS(
            f"seed_challenges done. created={result['created']}, "
            f"updated={result['updated']}, skipped={result['skipped']}"
        ))
