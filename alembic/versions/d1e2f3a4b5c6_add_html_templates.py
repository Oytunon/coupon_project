"""add html_templates table

Revision ID: d1e2f3a4b5c6
Revises: b7d2a5f8e3c1
Create Date: 2026-04-13 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'b7d2a5f8e3c1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tablo var mı diye kontrol et (DuplicateTable hatasını önlemek için)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'html_templates' not in inspector.get_table_names():
        op.create_table(
            'html_templates',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('html_content', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_html_templates_id'), 'html_templates', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_html_templates_id'), table_name='html_templates')
    op.drop_table('html_templates')
