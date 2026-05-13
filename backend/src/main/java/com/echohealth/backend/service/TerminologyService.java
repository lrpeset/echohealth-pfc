package com.echohealth.backend.service;

import com.echohealth.backend.dto.SnomedConceptResponse;
import java.util.List;

public interface TerminologyService {

    List<SnomedConceptResponse> searchConcepts(String query);

}