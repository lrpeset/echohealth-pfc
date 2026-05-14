package com.echohealth.backend.util;

public final class ClinicalConstants {

    private ClinicalConstants() {}

    public static final class Concepts {
        public static final String HEIGHT = "8302-2";
        public static final String WEIGHT = "29463-7";
        public static final String PULSE = "8867-4";
        public static final String BLOOD_PRESSURE = "85354-9";
        public static final String OXYGEN_SATURATION = "2708-6";

        public static final String PAIN_LOCATION = "70163-1";
        public static final String PAIN_INTENSITY = "72514-3";
        public static final String PAIN_NATURE = "440751004";
    }

    public static final class Terms {
        public static final String HEIGHT = "Body height";
        public static final String WEIGHT = "Body weight";
        public static final String PULSE = "Heart rate";
        public static final String BLOOD_PRESSURE = "Blood pressure panel";
        public static final String OXYGEN_SATURATION = "Oxygen saturation";

        public static final String PAIN_LOCATION = "Body site";
        public static final String PAIN_INTENSITY = "Pain severity - 0-10";
        public static final String PAIN_NATURE = "Type of pain";
    }

    public static final class FieldDefaults {
        public static final String HEIGHT_ID = "height";
        public static final String HEIGHT_LABEL = "Altura (cm)";
        public static final String HEIGHT_TYPE = "loinc-number";

        public static final String WEIGHT_ID = "weight";
        public static final String WEIGHT_LABEL = "Peso (kg)";
        public static final String WEIGHT_TYPE = "loinc-number";

        public static final String PULSE_ID = "pulse";
        public static final String PULSE_LABEL = "Pulso (ppm)";
        public static final String PULSE_TYPE = "loinc-number";

        public static final String BLOOD_PRESSURE_ID = "bloodPressure";
        public static final String BLOOD_PRESSURE_LABEL = "Presión arterial (mmHg)";
        public static final String BLOOD_PRESSURE_TYPE = "loinc-text";

        public static final String OXYGEN_SATURATION_ID = "oxygenSaturation";
        public static final String OXYGEN_SATURATION_LABEL = "Saturación de oxígeno (%)";
        public static final String OXYGEN_SATURATION_TYPE = "loinc-number";

        public static final String PAIN_LOCATION_ID = "painLocation";
        public static final String PAIN_LOCATION_LABEL = "Localización del dolor";
        public static final String PAIN_LOCATION_TYPE = "snomed-text";

        public static final String PAIN_NATURE_ID = "painNature";
        public static final String PAIN_NATURE_LABEL = "Naturaleza del dolor";
        public static final String PAIN_NATURE_TYPE = "snomed-text";

        public static final String PAIN_INTENSITY_ID = "painIntensity";
        public static final String PAIN_INTENSITY_LABEL = "Intensidad del dolor (0-10)";
        public static final String PAIN_INTENSITY_TYPE = "loinc-number";
    }
}
