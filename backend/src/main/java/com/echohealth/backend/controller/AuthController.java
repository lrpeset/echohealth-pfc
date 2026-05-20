package com.echohealth.backend.controller;

import com.echohealth.backend.model.User;
import com.echohealth.backend.repository.UserRepository;
import com.echohealth.backend.dto.LoginRequest;
import com.echohealth.backend.dto.AuthResponse;
import com.echohealth.backend.security.JwtProvider;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtProvider jwtProvider;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest login) {
        Optional<User> userOpt = userRepository.findByUsername(login.getUsername());

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuario no encontrado"));
        }

        User user = userOpt.get();

        if (passwordEncoder.matches(login.getPassword(), user.getPassword())) {
            String token = jwtProvider.createToken(user.getUsername(), user.getId());
            return ResponseEntity.ok(new AuthResponse(token));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Credenciales inválidas"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("El nombre de usuario ya existe");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userRepository.save(user);

        return ResponseEntity.ok("Médico registrado correctamente");
    }
}