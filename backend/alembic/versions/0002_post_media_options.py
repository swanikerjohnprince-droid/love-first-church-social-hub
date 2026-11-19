"""Add per-platform publishing options and multiple media attachments.

The initial migration uses the current SQLAlchemy metadata via create_all().
That can already create these objects, so this migration checks before adding
them to avoid DuplicateColumn / DuplicateTable errors on a fresh database.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_post_media_options"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # The initial migration may already have created this column from models.py.
    columns = {column["name"] for column in inspector.get_columns("post_variants")}
    if "platform_options" not in columns:
        op.add_column(
            "post_variants",
            sa.Column(
                "platform_options",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'{}'"),
            ),
        )

    # Likewise, Base.metadata.create_all() may already have created post_media
    # and its indexes as part of revision 0001.
    if not inspector.has_table("post_media"):
        op.create_table(
            "post_media",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "post_variant_id",
                sa.Uuid(),
                sa.ForeignKey("post_variants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "media_asset_id",
                sa.Uuid(),
                sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        )

    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("post_media")}
    if "ix_post_media_post_variant_id" not in existing_indexes:
        op.create_index(
            "ix_post_media_post_variant_id",
            "post_media",
            ["post_variant_id"],
        )
    if "ix_post_media_media_asset_id" not in existing_indexes:
        op.create_index(
            "ix_post_media_media_asset_id",
            "post_media",
            ["media_asset_id"],
        )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("post_media"):
        existing_indexes = {index["name"] for index in inspector.get_indexes("post_media")}
        if "ix_post_media_media_asset_id" in existing_indexes:
            op.drop_index("ix_post_media_media_asset_id", table_name="post_media")
        if "ix_post_media_post_variant_id" in existing_indexes:
            op.drop_index("ix_post_media_post_variant_id", table_name="post_media")
        op.drop_table("post_media")

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("post_variants")}
    if "platform_options" in columns:
        op.drop_column("post_variants", "platform_options")
