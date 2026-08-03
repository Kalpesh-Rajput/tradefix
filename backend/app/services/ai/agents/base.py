import uuid
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.insight import Insight, InsightSeverity, InsightType
from app.services.ai.openrouter_client import AiNotConfiguredError, generate_text
from app.services.ai.prompts import BASE_SYSTEM_PROMPT


class BaseAgent(ABC):
    name: str
    display_name: str
    insight_type: InsightType
    default_severity: InsightSeverity = InsightSeverity.info

    @abstractmethod
    def gather_stats(self, db: Session, user_id: uuid.UUID) -> dict | None:
        """Return precomputed stats dict, or None if there isn't enough data yet."""

    @abstractmethod
    def build_prompt(self, stats: dict) -> str:
        ...

    def title_for(self, stats: dict) -> str:
        return self.display_name

    def run(self, db: Session, user_id: uuid.UUID) -> AgentRun:
        stats = self.gather_stats(db, user_id)
        if stats is None:
            run = AgentRun(
                user_id=user_id,
                agent_name=self.name,
                status=AgentRunStatus.skipped,
                message="Not enough trade history yet for this agent.",
            )
            db.add(run)
            db.commit()
            db.refresh(run)
            return run

        try:
            body = generate_text(BASE_SYSTEM_PROMPT, self.build_prompt(stats))
        except AiNotConfiguredError as exc:
            run = AgentRun(
                user_id=user_id,
                agent_name=self.name,
                status=AgentRunStatus.failed,
                message=str(exc),
            )
            db.add(run)
            db.commit()
            db.refresh(run)
            return run
        except Exception as exc:  # noqa: BLE001
            run = AgentRun(
                user_id=user_id,
                agent_name=self.name,
                status=AgentRunStatus.failed,
                message=f"Agent run failed: {exc}",
            )
            db.add(run)
            db.commit()
            db.refresh(run)
            return run

        insight = Insight(
            user_id=user_id,
            agent_name=self.name,
            type=self.insight_type,
            title=self.title_for(stats),
            body=body,
            severity=self.default_severity,
            data=stats,
        )
        db.add(insight)
        db.flush()

        run = AgentRun(
            user_id=user_id,
            agent_name=self.name,
            status=AgentRunStatus.success,
            insight_id=insight.id,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run
