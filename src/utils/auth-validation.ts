const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginErrors = {
  email?: string;
  password?: string;
};

export type RegisterErrors = LoginErrors & {
  displayName?: string;
  confirmPassword?: string;
};

export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateRegistration(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): RegisterErrors {
  const errors: RegisterErrors = {
    ...validateLogin(email, password),
  };
  const normalizedName = displayName.trim();

  if (!normalizedName) {
    errors.displayName = 'Display name is required.';
  } else if (normalizedName.length < 2) {
    errors.displayName = 'Display name must be at least 2 characters.';
  } else if (normalizedName.length > 60) {
    errors.displayName = 'Display name must be 60 characters or fewer.';
  }

  if (password && password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function hasErrors<T extends object>(errors: T) {
  return Object.values(errors as Record<string, string | undefined>).some(Boolean);
}
