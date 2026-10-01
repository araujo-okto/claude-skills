// Base error for expected failures. `code` is stable API — clients branch on it.
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Invalid or expired session.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid email or password.") {
    super(message, 401, "INVALID_CREDENTIALS");
  }
}

export class AccountBlockedError extends AppError {
  constructor(message = "Account inactive or blocked.") {
    super(message, 403, "ACCOUNT_BLOCKED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You are not allowed to access this resource.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicting state.", code = "CONFLICT") {
    super(message, 409, code);
  }
}
