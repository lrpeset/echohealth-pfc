package com.echohealth.backend.service;

import com.echohealth.backend.dto.ConceptResponse;
import java.util.List;

public interface TerminologyService {

    List<ConceptResponse> searchConcepts(String query);

}