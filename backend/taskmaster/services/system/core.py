from taskmaster.api.resources.system.service.service import AbstractSystemService
from taskmaster.api.resources.system.types.health_response import HealthResponse


class SystemService(AbstractSystemService):
    def get_health(self) -> HealthResponse:
        return HealthResponse(status="OK")
