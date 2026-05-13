package com.echohealth.backend.exception;

public class SnowstormException extends RuntimeException {

    private final boolean recoverable;

    public SnowstormException(String message) {
        super(message);
        this.recoverable = true;
    }

    public SnowstormException(String message, Throwable cause) {
        super(message, cause);
        this.recoverable = true;
    }

    public SnowstormException(String message, boolean recoverable) {
        super(message);
        this.recoverable = recoverable;
    }

    public SnowstormException(String message, Throwable cause, boolean recoverable) {
        super(message, cause);
        this.recoverable = recoverable;
    }

    public boolean isRecoverable() {
        return recoverable;
    }
}