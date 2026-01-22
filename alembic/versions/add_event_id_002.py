"""add event_id to coupons table

Revision ID: add_event_id_002
Revises: add_event_tables_001
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_event_id_002'
down_revision = 'add_event_tables_001'
branch_labels = None
depends_on = None


def upgrade():
    # Coupon tablosuna event_id kolonu ekle
    op.add_column('coupons', sa.Column('event_id', sa.Integer(), nullable=True))
    
    # Foreign key constraint ekle
    op.create_foreign_key(
        'fk_coupons_event_id',
        'coupons', 'events',
        ['event_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Index ekle (performans için)
    op.create_index('ix_coupons_event_id', 'coupons', ['event_id'])


def downgrade():
    # Geri alma işlemleri
    op.drop_index('ix_coupons_event_id', table_name='coupons')
    op.drop_constraint('fk_coupons_event_id', 'coupons', type_='foreignkey')
    op.drop_column('coupons', 'event_id')
