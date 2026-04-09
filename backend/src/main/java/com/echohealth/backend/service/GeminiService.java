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

    public String analyzeAudio(MultipartFile file) {
        
        try (Client client = Client.builder().apiKey(apiKey).build()) {

            String prompt = 
                "You are an expert medical assistant. Analyze this consultation audio and extract the patient data. " +
                "Return a JSON with these exact keys: " +
                "1. 'reasonForVisit' (string, summarize the reason concisely IN SPANISH). " +
                "2. 'height' (number, in cm). " +
                "3. 'weight' (number, in kg). " +
                "4. 'pulse' (number, bpm). " +
                "Rule: Do not translate the medical concepts to English, keep the text values in Spanish.";

            Part textPart = Part.builder().text(prompt).build();
            
            Part audioPart = Part.builder()
                    .inlineData(Blob.builder()
                            .data(file.getBytes()) 
                            .mimeType("audio/.m4a") 
                            .build())
                    .build();

            Content content = Content.builder().parts(Arrays.asList(textPart, audioPart)).build();

            GenerateContentConfig config = GenerateContentConfig.builder()
                    .responseMimeType("application/json")
                    .build();

            GenerateContentResponse response = client.models.generateContent(
                    "gemini-2.5-flash", 
                    content, 
                    config
            );

            return response.text();

        } catch (Exception e) {
            System.err.println("🚨 ERROR SDK Oficial: " + e.getMessage());
            e.printStackTrace();
            return "{\"error\": \"Fallo al procesar con la IA oficial: " + e.getMessage() + "\"}";
        }
    }
}