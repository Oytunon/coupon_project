"""add reward_payouts table (dedupe ledger for reward distribution)

Revision ID: 3feff6dceed8
Revises: f2e3d4c5b6a7
Create Date: 2026-08-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '3feff6dceed8'
down_revision = 'f2e3d4c5b6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'reward_payouts' not in inspector.get_table_names():
        op.create_table(
            'reward_payouts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reward_job_id', sa.Integer(), sa.ForeignKey('reward_jobs.id', ondelete='SET NULL'), nullable=True),
            sa.Column('client_id', sa.Integer(), nullable=False),
            sa.Column('reward_type', sa.String(length=20), nullable=False),
            sa.Column('amount', sa.Float(), nullable=True),
            sa.Column('criteria_type', sa.String(length=50), nullable=True),
            sa.Column('criteria_value', sa.Float(), nullable=True),
            sa.Column('partner_bonus_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('bapi_response', postgresql.JSONB(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('sent_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('event_id', 'client_id', name='uq_reward_payouts_event_client'),
        )
        op.create_index(op.f('ix_reward_payouts_id'), 'reward_payouts', ['id'], unique=False)
        op.create_index(op.f('ix_reward_payouts_event_id'), 'reward_payouts', ['event_id'], unique=False)
        op.create_index(op.f('ix_reward_payouts_client_id'), 'reward_payouts', ['client_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'reward_payouts' in inspector.get_table_names():
        op.drop_index(op.f('ix_reward_payouts_client_id'), table_name='reward_payouts')
        op.drop_index(op.f('ix_reward_payouts_event_id'), table_name='reward_payouts')
        op.drop_index(op.f('ix_reward_payouts_id'), table_name='reward_payouts')
        op.drop_table('reward_payouts')
