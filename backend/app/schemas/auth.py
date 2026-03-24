from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    farm_name: str | None = None
    location_city: str | None = None
    location_state: str | None = None
    language: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class ProfileResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    farm_name: str | None = None
    location_city: str | None = None
    location_state: str | None = None
    language: str | None = None

    class Config:
        from_attributes = True