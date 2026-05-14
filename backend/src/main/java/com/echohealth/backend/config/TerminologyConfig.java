package com.echohealth.backend.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class TerminologyConfig {

    @Bean
    @Qualifier("snomedFhirRestClient")
    public RestClient snomedFhirRestClient(@Value("${snomed.fhir-base-url:https://r4.ontoserver.csiro.au/fhir}") String baseUrl) {
        String normalizedUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        return RestClient.builder()
                .baseUrl(normalizedUrl)
                .build();
    }

    @Bean
    @Qualifier("loincFhirRestClient")
    public RestClient loincFhirRestClient(@Value("${loinc.fhir-base-url:https://r4.ontoserver.csiro.au/fhir}") String baseUrl) {
        String normalizedUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        return RestClient.builder()
                .baseUrl(normalizedUrl)
                .build();
    }
}
