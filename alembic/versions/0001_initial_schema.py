# type: ignore
# pyright: reportGeneralTypeIssues=false, reportArgumentType=false, reportMissingImports=false, reportAttributeAccessIssue=false
# flake8: noqa
"""Initial schema with pgvector

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-07-04 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
try:
    import pgvector  # type: ignore # noqa
    import pgvector.sqlalchemy  # type: ignore # noqa
    vector_type = pgvector.sqlalchemy.Vector(1536)
except ImportError:
    from sqlalchemy.types import UserDefinedType
    class Vector(UserDefinedType):
        def __init__(self, dim=None):
            self.dim = dim
        def get_col_spec(self, **kw):
            return f"vector({self.dim})" if self.dim else "vector"
    vector_type = Vector(1536)

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector extension is enabled
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create companies table
    op.create_table(
        'companies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'], unique=False)
    op.create_index(op.f('ix_companies_is_deleted'), 'companies', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_companies_name'), 'companies', ['name'], unique=False)

    # Create UserRole enum type in postgres
    user_role_enum = sa.Enum('ADMIN', 'RECRUITER', 'CANDIDATE', name='userrole')
    user_role_enum.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', user_role_enum, nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_company_id'), 'users', ['company_id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_is_deleted'), 'users', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)

    # Create jobs table
    op.create_table(
        'jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('experience', sa.String(length=100), nullable=True),
        sa.Column('salary_min', sa.Float(), nullable=True),
        sa.Column('salary_max', sa.Float(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('employment_type', sa.String(length=100), nullable=True, default='full-time'),
        sa.Column('notice_period', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='open'),
        sa.Column('parsed_requirements', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jobs_company_id'), 'jobs', ['company_id'], unique=False)
    op.create_index(op.f('ix_jobs_id'), 'jobs', ['id'], unique=False)
    op.create_index(op.f('ix_jobs_is_deleted'), 'jobs', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_jobs_status'), 'jobs', ['status'], unique=False)
    op.create_index(op.f('ix_jobs_title'), 'jobs', ['title'], unique=False)

    # Create candidates table
    op.create_table(
        'candidates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('linkedin', sa.String(length=255), nullable=True),
        sa.Column('github', sa.String(length=255), nullable=True),
        sa.Column('portfolio', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('experience', sa.Float(), nullable=True),
        sa.Column('current_company', sa.String(length=255), nullable=True),
        sa.Column('notice_period', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='new'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_candidates_email'), 'candidates', ['email'], unique=True)
    op.create_index(op.f('ix_candidates_id'), 'candidates', ['id'], unique=False)
    op.create_index(op.f('ix_candidates_is_deleted'), 'candidates', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_candidates_linkedin'), 'candidates', ['linkedin'], unique=False)
    op.create_index(op.f('ix_candidates_phone'), 'candidates', ['phone'], unique=False)
    op.create_index(op.f('ix_candidates_status'), 'candidates', ['status'], unique=False)

    # Create embeddings table
    op.create_table(
        'embeddings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('vector_reference', vector_type, nullable=True),
        sa.Column('model', sa.String(length=100), nullable=False, default='text-embedding-3-small'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_embeddings_candidate_id'), 'embeddings', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_embeddings_id'), 'embeddings', ['id'], unique=False)
    op.create_index(op.f('ix_embeddings_is_deleted'), 'embeddings', ['is_deleted'], unique=False)

    # Create resumes table
    op.create_table(
        'resumes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('parsed_text', sa.String(), nullable=True),
        sa.Column('embedding_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('parsed_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.ForeignKeyConstraint(['embedding_id'], ['embeddings.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resumes_candidate_id'), 'resumes', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_resumes_id'), 'resumes', ['id'], unique=False)
    op.create_index(op.f('ix_resumes_is_deleted'), 'resumes', ['is_deleted'], unique=False)

    # Create candidate_skills table
    op.create_table(
        'candidate_skills',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('skill_name', sa.String(length=100), nullable=False),
        sa.Column('years', sa.Float(), nullable=True),
        sa.Column('level', sa.String(length=50), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_candidate_skills_candidate_id'), 'candidate_skills', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_candidate_skills_id'), 'candidate_skills', ['id'], unique=False)
    op.create_index(op.f('ix_candidate_skills_is_deleted'), 'candidate_skills', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_candidate_skills_skill_name'), 'candidate_skills', ['skill_name'], unique=False)

    # Create interviews table
    op.create_table(
        'interviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('mode', sa.String(length=50), nullable=False, default='ai-chat'),
        sa.Column('status', sa.String(length=50), nullable=False, default='scheduled'),
        sa.Column('transcript', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('video_url', sa.String(length=500), nullable=True),
        sa.Column('audio_url', sa.String(length=500), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_interviews_candidate_id'), 'interviews', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_interviews_id'), 'interviews', ['id'], unique=False)
    op.create_index(op.f('ix_interviews_is_deleted'), 'interviews', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_interviews_job_id'), 'interviews', ['job_id'], unique=False)
    op.create_index(op.f('ix_interviews_status'), 'interviews', ['status'], unique=False)

    # Create questions table
    op.create_table(
        'questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=True),
        sa.Column('difficulty', sa.String(length=50), nullable=True),
        sa.Column('question', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    op.create_index(op.f('ix_questions_interview_id'), 'questions', ['interview_id'], unique=False)
    op.create_index(op.f('ix_questions_is_deleted'), 'questions', ['is_deleted'], unique=False)

    # Create answers table
    op.create_table(
        'answers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_answer', sa.String(), nullable=False),
        sa.Column('evaluation_notes', sa.String(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_answers_id'), 'answers', ['id'], unique=False)
    op.create_index(op.f('ix_answers_is_deleted'), 'answers', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_answers_question_id'), 'answers', ['question_id'], unique=False)

    # Create evaluations table
    op.create_table(
        'evaluations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('technical', sa.Float(), nullable=True),
        sa.Column('communication', sa.Float(), nullable=True),
        sa.Column('problem_solving', sa.Float(), nullable=True),
        sa.Column('leadership', sa.Float(), nullable=True),
        sa.Column('behavior', sa.Float(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('recommendation', sa.String(length=100), nullable=True),
        sa.Column('critic_review', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evaluations_candidate_id'), 'evaluations', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_evaluations_id'), 'evaluations', ['id'], unique=False)
    op.create_index(op.f('ix_evaluations_is_deleted'), 'evaluations', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_evaluations_overall_score'), 'evaluations', ['overall_score'], unique=False)

    # Create reports table
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('summary', sa.String(), nullable=False),
        sa.Column('pros', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('cons', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('risks', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('recommendation', sa.String(length=100), nullable=True),
        sa.Column('generated_by', sa.String(length=100), nullable=False, default='evaluation-agent'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reports_candidate_id'), 'reports', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_reports_id'), 'reports', ['id'], unique=False)
    op.create_index(op.f('ix_reports_is_deleted'), 'reports', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_reports_job_id'), 'reports', ['job_id'], unique=False)

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='pending'),
        sa.Column('channel', sa.String(length=50), nullable=False, default='email'),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_candidate_id'), 'notifications', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index(op.f('ix_notifications_is_deleted'), 'notifications', ['is_deleted'], unique=False)

    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_agent', sa.String(length=100), nullable=True),
        sa.Column('state', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('checkpoint', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='active'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_id'), 'sessions', ['id'], unique=False)
    op.create_index(op.f('ix_sessions_is_deleted'), 'sessions', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_sessions_job_id'), 'sessions', ['job_id'], unique=False)

    # Create agent_logs table
    op.create_table(
        'agent_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('agent_name', sa.String(length=100), nullable=False),
        sa.Column('input', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('latency', sa.Float(), nullable=True),
        sa.Column('token_usage', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='success'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_logs_agent_name'), 'agent_logs', ['agent_name'], unique=False)
    op.create_index(op.f('ix_agent_logs_id'), 'agent_logs', ['id'], unique=False)
    op.create_index(op.f('ix_agent_logs_is_deleted'), 'agent_logs', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_agent_logs_session_id'), 'agent_logs', ['session_id'], unique=False)

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity', sa.String(length=100), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_is_deleted'), 'audit_logs', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('agent_logs')
    op.drop_table('sessions')
    op.drop_table('notifications')
    op.drop_table('reports')
    op.drop_table('evaluations')
    op.drop_table('answers')
    op.drop_table('questions')
    op.drop_table('interviews')
    op.drop_table('candidate_skills')
    op.drop_table('resumes')
    op.drop_table('embeddings')
    op.drop_table('candidates')
    op.drop_table('jobs')
    op.drop_table('users')
    sa.Enum('ADMIN', 'RECRUITER', 'CANDIDATE', name='userrole').drop(op.get_bind(), checkfirst=True)
    op.drop_table('companies')
