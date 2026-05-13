package com.echohealth.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class TerminologyConfig {

    @Bean
    public RestClient restClient(@Value("${snomed.base-url:https://snowstorm.ihtsdotools.org/snowstorm/snomed-ct}") String baseUrl) {
        String normalizedUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        return RestClient.builder()
                .baseUrl(normalizedUrl)
                .build();
    }
}