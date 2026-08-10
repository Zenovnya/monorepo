"""create mascot tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-10 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mascot_phrases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('trigger', sa.String(length=64), nullable=False),
        sa.Column('phrase', sa.Text(), nullable=False),
        sa.Column('emotion', sa.String(length=64), nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('show_once', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )
    op.create_index('ix_mascot_phrases_trigger', 'mascot_phrases', ['trigger'])

    op.create_table(
        'user_mascot_state',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pet_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_phrase_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.ForeignKeyConstraint(['last_phrase_id'], ['mascot_phrases.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_user_mascot_state_user_id', 'user_mascot_state', ['user_id'], unique=True)

    op.create_table(
        'user_shown_phrases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('phrase_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'shown_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.ForeignKeyConstraint(['phrase_id'], ['mascot_phrases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'phrase_id', name='uq_user_shown_phrases'),
    )
    op.create_index('ix_user_shown_phrases_phrase_id', 'user_shown_phrases', ['phrase_id'])
    op.create_index('ix_user_shown_phrases_user_id', 'user_shown_phrases', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_shown_phrases_user_id', table_name='user_shown_phrases')
    op.drop_index('ix_user_shown_phrases_phrase_id', table_name='user_shown_phrases')
    op.drop_table('user_shown_phrases')
    op.drop_index('ix_user_mascot_state_user_id', table_name='user_mascot_state')
    op.drop_table('user_mascot_state')
    op.drop_index('ix_mascot_phrases_trigger', table_name='mascot_phrases')
    op.drop_table('mascot_phrases')