"""Add event-based tables

Revision ID: add_event_tables_001
Revises: 
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'add_event_tables_001'
down_revision = None  # İlk migration olarak kabul ediyoruz
branch_labels = None
depends_on = None


def upgrade():
    """Yeni event-based tablolar oluştur ve mevcut tabloları güncelle."""
    
    # 1. Events tablosu oluştur
    op.create_table(
        'events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='draft'),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('won_point_multiplier', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('loss_point_multiplier', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('draw_point_multiplier', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('rules', JSONB(), nullable=False, server_default=sa.text(
            """'{
                "min_stake": 100,
                "min_odd": 1.5,
                "min_combination": 2,
                "allowed_league_ids": [],
                "max_coupons_per_user": null,
                "is_live_allowed": true,
                "scoring_formula": "stake_times_odds",
                "combo_bonus_enabled": false,
                "combo_bonus_multiplier": 0.1
            }'::jsonb"""
        )),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['admin_users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_events_status', 'events', ['status'])
    op.create_index('idx_events_dates', 'events', ['start_date', 'end_date'])
    
    # 2. Coupon Event Results tablosu oluştur
    op.create_table(
        'coupon_event_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coupon_id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('is_eligible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('eligibility_reason', sa.Text(), nullable=True),
        sa.Column('coupon_state', sa.String(length=16), nullable=True),
        sa.Column('points_earned', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('points_calculation', JSONB(), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),
        sa.Column('last_checked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['coupon_id'], ['coupons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('coupon_id', 'event_id', name='uq_coupon_event')
    )
    op.create_index('idx_cer_coupon', 'coupon_event_results', ['coupon_id'])
    op.create_index('idx_cer_event', 'coupon_event_results', ['event_id'])
    op.create_index('idx_cer_eligible', 'coupon_event_results', ['event_id', 'is_eligible'])
    op.create_index('idx_cer_points', 'coupon_event_results', ['event_id', 'points_earned'], postgresql_ops={'points_earned': 'DESC'})
    
    # 3. Coupons tablosuna yeni kolonlar ekle
    op.add_column('coupons', sa.Column('overall_state', sa.String(length=16), server_default='pending'))
    op.add_column('coupons', sa.Column('is_processed', sa.Boolean(), server_default='false'))
    op.add_column('coupons', sa.Column('processed_at', sa.DateTime(), nullable=True))
    op.add_column('coupons', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    op.create_index('idx_coupons_processed', 'coupons', ['is_processed', 'last_synced_at'])
    
    # 4. Participants tablosuna yeni kolonlar ekle
    op.add_column('participants', sa.Column('total_points', sa.Float(), server_default='0.0'))
    op.add_column('participants', sa.Column('is_active', sa.Boolean(), server_default='true'))


def downgrade():
    """Migration'ı geri al."""
    
    # Participants kolonlarını kaldır
    op.drop_column('participants', 'is_active')
    op.drop_column('participants', 'total_points')
    
    # Coupons kolonlarını kaldır
    op.drop_index('idx_coupons_processed', 'coupons')
    op.drop_column('coupons', 'last_synced_at')
    op.drop_column('coupons', 'processed_at')
    op.drop_column('coupons', 'is_processed')
    op.drop_column('coupons', 'overall_state')
    
    # Coupon Event Results tablosunu kaldır
    op.drop_index('idx_cer_points', 'coupon_event_results')
    op.drop_index('idx_cer_eligible', 'coupon_event_results')
    op.drop_index('idx_cer_event', 'coupon_event_results')
    op.drop_index('idx_cer_coupon', 'coupon_event_results')
    op.drop_table('coupon_event_results')
    
    # Events tablosunu kaldır
    op.drop_index('idx_events_dates', 'events')
    op.drop_index('idx_events_status', 'events')
    op.drop_table('events')
