package com.echohealth.backend.exception;

public class TerminologyException extends RuntimeException {

    public TerminologyException(String message) {
        super(message);
    }

    public TerminologyException(String message, Throwable cause) {
        super(message, cause);
    }
}
