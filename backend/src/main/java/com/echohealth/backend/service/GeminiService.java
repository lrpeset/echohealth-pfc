package com.echohealth.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.google.genai.types.Blob;

import java.util.Arrays;

@Service
public class GeminiService {

    @Value("${google.api.key}")
    private String apiKey;

    // Constante optimizada para tokens y precisión en diálogos reales
    private static final String MEDICAL_PROMPT = """
        Act as an expert Medical Scribe. Extract clinical data from the consultation audio into strict JSON.

        RULES:
        1. reasonForVisit: Professional clinical summary in SPANISH.
        2. ANONYMIZATION (CRITICAL): NEVER include patient names, locations, or personal identifiers. Use neutral language like "Paciente refiere..." or passive voice.
        3. height (cm), weight (kg), pulse (bpm): Extract as numbers.
        4. If values are corrected in audio, use the LAST validated one.
        5. Use null if a missing data point.
            
        OUTPUT FORMAT (Strict JSON):
        {
            "reasonForVisit": "string or null",
            "height": number or null,
            "weight": number or null,
            "pulse": number or null
        }
        """;

    public String analyzeAudio(MultipartFile file) {

        try (Client client = Client.builder().apiKey(apiKey).build()) {

            String mimeType = file.getContentType();
            if (mimeType == null || mimeType.isEmpty() || mimeType.equals("application/octet-stream")) {
                mimeType = "audio/m4a";
            }

            System.out.println("Procesando audio con MimeType detectado: " + mimeType);

            Part textPart = Part.builder()
                    .text(MEDICAL_PROMPT)
                    .build();

            Part audioPart = Part.builder()
                    .inlineData(Blob.builder()
                            .data(file.getBytes())
                            .mimeType(mimeType)
                            .build())
                    .build();

            Content content = Content.builder()
                    .parts(Arrays.asList(textPart, audioPart))
                    .build();

            GenerateContentConfig config = GenerateContentConfig.builder()
                    .responseMimeType("application/json")
                    .build();

            GenerateContentResponse response = client.models.generateContent(
                    "gemini-2.5-flash",
                    content,
                    config);

            return response.text();

        } catch (Exception e) {
            System.err.println("🚨 ERROR SDK Oficial: " + e.getMessage());
            e.printStackTrace();
            return "{\"error\": \"Fallo al procesar con la IA oficial: " + e.getMessage() + "\"}";
        }
    }
}