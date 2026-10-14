"""create content tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-09 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'branches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=255), nullable=True),
        sa.Column('is_premium', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )

    op.create_table(
        'lessons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('branch_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_lessons_branch_id', 'lessons', ['branch_id'])

    op.create_table(
        'cases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('situation', sa.Text(), nullable=False),
        sa.Column('case_type', sa.String(length=32), nullable=False, server_default=sa.text("'simple'")),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column('lex_entrance_type', sa.String(length=32), nullable=True),
        sa.Column('lex_hint_text', sa.Text(), nullable=True),
        sa.Column('lex_hint_option_id', sa.Integer(), nullable=True),
        sa.Column('scene_background', sa.String(length=255), nullable=True),
        sa.Column('scene_config', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_cases_lesson_id', 'cases', ['lesson_id'])

    op.create_table(
        'case_options',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_case_options_case_id', 'case_options', ['case_id'])


def downgrade() -> None:
    op.drop_index('ix_case_options_case_id', table_name='case_options')
    op.drop_table('case_options')
    op.drop_index('ix_cases_lesson_id', table_name='cases')
    op.drop_table('cases')
    op.drop_index('ix_lessons_branch_id', table_name='lessons')
    op.drop_table('lessons')
    op.drop_table('branches')