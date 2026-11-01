import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.common.models import CurrentUser, UserRole
from backend.common.security import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    x_user_name: str | None = Header(None, alias="X-User-Name"),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
    auth_header: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    if x_user_id and x_user_name and x_user_role:
        try:
            return CurrentUser(
                user_id=uuid.UUID(x_user_id), username=x_user_name, role=UserRole(x_user_role)
            )
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID or role in headers",
            ) from e

    if auth_header and auth_header.credentials:
        token_payload = decode_access_token(auth_header.credentials)
        if token_payload:
            return CurrentUser(
                user_id=token_payload.user_id,
                username=token_payload.username,
                role=token_payload.role,
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided or are invalid",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that ensures the authenticated user has ADMIN role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to administrators only",
        )
    return current_user


def require_authenticated(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that ensures the user is authenticated."""
    return current_user
