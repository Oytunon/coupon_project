"""add event_id to excluded_bet_cache

Revision ID: b7d2a5f8e3c1
Revises: 4ab041b28058
Create Date: 2026-03-06 15:58:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'b7d2a5f8e3c1'
down_revision = '4ab041b28058'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Get database connection
    conn = op.get_bind()
    
    # 1. Clear existing cache to prevent unique constraint violations with missing event_ids
    op.execute("DELETE FROM excluded_bet_cache")
    
    # 2. Add event_id column
    op.add_column('excluded_bet_cache', sa.Column('event_id', sa.Integer(), nullable=False))
    
    # 3. Drop old unique constraint on bet_id if it exists
    insp = Inspector.from_engine(conn)
    indexes = insp.get_indexes('excluded_bet_cache')
    for index in indexes:
        if index['name'] == 'ix_excluded_bet_cache_bet_id' and index['unique']:
            op.drop_index('ix_excluded_bet_cache_bet_id', table_name='excluded_bet_cache')
            # Recreate it as non-unique
            op.create_index(op.f('ix_excluded_bet_cache_bet_id'), 'excluded_bet_cache', ['bet_id'], unique=False)
            break
            
    # 4. Create index for event_id
    op.create_index(op.f('ix_excluded_bet_cache_event_id'), 'excluded_bet_cache', ['event_id'], unique=False)
    
    # 5. Create new composite unique constraint
    op.create_unique_constraint('uq_excluded_bet_event', 'excluded_bet_cache', ['bet_id', 'event_id'])


def downgrade() -> None:
    op.drop_constraint('uq_excluded_bet_event', 'excluded_bet_cache', type_='unique')
    op.drop_index(op.f('ix_excluded_bet_cache_event_id'), table_name='excluded_bet_cache')
    op.drop_column('excluded_bet_cache', 'event_id')
    # Restore unique index on bet_id
    op.drop_index(op.f('ix_excluded_bet_cache_bet_id'), table_name='excluded_bet_cache')
    op.create_index(op.f('ix_excluded_bet_cache_bet_id'), 'excluded_bet_cache', ['bet_id'], unique=True)
