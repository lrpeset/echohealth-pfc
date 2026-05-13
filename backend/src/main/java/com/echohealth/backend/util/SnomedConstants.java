package com.echohealth.backend.util;

public final class SnomedConstants {

    private SnomedConstants() {}

    public static final class Concepts {
        public static final String HEIGHT = "50243002";
        public static final String WEIGHT = "271603002";
        public static final String PULSE = "364075005";

        public static final String PAIN = "22253000";
        public static final String INFECTION = "87628006";
        public static final String TRAUMA = "399211003";
    }

    public static final class Terms {
        public static final String HEIGHT = "Body height measure";
        public static final String WEIGHT = "Body weight";
        public static final String PULSE = "Pulse rate";

        public static final String PAIN = "Pain";
        public static final String INFECTION = "Infectious disease";
        public static final String TRAUMA = "Traumatic injury";
    }

    public static final class FieldDefaults {
        public static final String REASON_FOR_VISIT_ID = "reasonForVisit";
        public static final String REASON_FOR_VISIT_LABEL = "Motivo de la visita";
        public static final String REASON_FOR_VISIT_TYPE = "snomed-text";

        public static final String HEIGHT_ID = "height";
        public static final String HEIGHT_LABEL = "Altura (cm)";
        public static final String HEIGHT_TYPE = "snomed-number";

        public static final String WEIGHT_ID = "weight";
        public static final String WEIGHT_LABEL = "Peso (kg)";
        public static final String WEIGHT_TYPE = "snomed-number";

        public static final String PULSE_ID = "pulse";
        public static final String PULSE_LABEL = "Pulso (ppm)";
        public static final String PULSE_TYPE = "snomed-number";
    }
}