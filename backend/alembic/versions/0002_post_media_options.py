"""Add per-platform publishing options and multiple media attachments."""
from alembic import op
import sqlalchemy as sa

revision = "0002_post_media_options"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("post_variants", sa.Column("platform_options", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
    op.create_table(
        "post_media",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("post_variant_id", sa.Uuid(), sa.ForeignKey("post_variants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_asset_id", sa.Uuid(), sa.ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_post_media_post_variant_id", "post_media", ["post_variant_id"])
    op.create_index("ix_post_media_media_asset_id", "post_media", ["media_asset_id"])

def downgrade():
    op.drop_index("ix_post_media_media_asset_id", table_name="post_media")
    op.drop_index("ix_post_media_post_variant_id", table_name="post_media")
    op.drop_table("post_media")
    op.drop_column("post_variants", "platform_options")
