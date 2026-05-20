# EchoHealth — Clinical Record Automation Platform (v1.0)

EchoHealth es una solución tecnológica modular y desacoplada diseñada para mitigar la carga administrativa y burocrática del personal sanitario durante la consulta clínica. Mediante el uso de un pipeline de procesamiento multimodal de lenguaje natural, la plataforma automatiza la conversión de narrativas orales libres en estructuras de datos clínicos normalizados, restituyendo el contacto visual directo y humanizando la relación médico-paciente.

---

## Arquitectura del Sistema

El proyecto está estructurado bajo un patrón de **Monorepo** que desacopla la persistencia, la lógica de negocio y la interfaz de usuario:

### Lógica de Servidor (`/backend`)

- **Entorno de Ejecución:** Java 21 LTS y Spring Boot 4 de conformidad estricta con la especificación **Jakarta EE 11**.
- **Persistencia Documental:** Motor NoSQL **MongoDB** bajo un patrón Entidad-Atributo-Valor (EAV) polimórfico, persistiendo simultáneamente un array indexable (`fields[]`) para linaje analítico y un mapa plano (`content{}`) para optimización de lecturas en caliente.
- **Seguridad Perimetral:** Arquitectura _Stateless_ gobernada por tokens **JWT** (JSON Web Tokens). Aislamiento completo de historias clínicas a nivel de controlador mediante la extracción del identificador del facultativo desde el _Security Principal_ inyectado, bloqueando vulnerabilidades de suplantación horizontal (_ID Spoofing_).

### Cliente Multiplataforma (`/frontend`)

- **Core:** React Native integrado bajo el ciclo de vida de **Expo SDK 54**.
- **Gestión de Rutas:** Arquitectura jerárquica de vistas controlada mediante `@react-navigation`.
- **Subsistema de Audio y Compartición:** Captura de flujos binarios en formato nativo `.m4a` a través de `expo-av` y pasarela de despacho local mediante la API de bajo nivel `expo-sharing`.

---

## Ingeniería de IA e Interoperabilidad

- **Pipeline Multimodal:** Orquestación síncrona con el modelo comercial estable `gemini-2.5-flash` a través del SDK oficial de Google GenAI. Para optimizar el rendimiento, el cliente HTTP opera bajo un patrón _Singleton_ controlado por la anotación `@PostConstruct` y cuenta con un test de humo de conectividad reactivo al arranque (`testGeminiConnectivity()`).
- **Prompting Zero-Trust:** Inyección dinámica de un protocolo de comunicación estructurado de 6 partes que fuerza un tipado estricto en el JSON de salida. El prompt obliga a la IA a asignar valores `null` limpios ante cualquier variable no verbalizada, erradicando por completo el riesgo de alucinación semántica.
- **Estándar Internacional HL7 FHIR R4:** Motor de exportación nativo (`fhirExport.js`) que transforma los esquemas abstractos de la base de datos en recursos estructurados de tipo `Bundle document`. Cumple de forma estricta la regla core _dom-6_ mediante la inyección algorítmica de narrativa XHTML indexable.

---

## Suite de Aseguramiento de la Calidad (QA)

La plataforma cuenta con un entorno de pruebas automatizadas que valida la estabilidad y la integridad de los datos en ambos extremos de la arquitectura:

- **Pruebas de Frontend (Jest):** **32/32 Tests PASS**. Cobertura enfocada en la degradación elegante de las APIs de almacenamiento, la normalización de esquemas clínicos y la consistencia estructural del Bundle FHIR.
- **Pruebas de Backend (JUnit 5 + Mockito):** **15/15 Tests PASS**. Cobertura dedicada a auditar la corrección automática de IDs alucinados por la IA, la validación estricta de rangos biológicos (mitigación del bug del falso cero) y la resiliencia en la inicialización del contexto de Spring.

---

## 📂 Estructura Real del Repositorio

```text
echohealth-pfc/
├── LICENSE                     # Licencia de distribución del proyecto
├── README.md                   # Documentación principal del ecosistema
├── backend/                    # Core del Servidor Central (Spring Boot 4)
│   ├── pom.xml                 # Descriptor de dependencias de Maven
│   ├── mvnw                    # Wrapper ejecutable para entornos Unix/Linux
│   ├── mvnw.cmd                # Wrapper ejecutable para entornos Windows
│   └── src/                    # Código fuente estructurado del backend
│       ├── main/java/          # Controladores, Servicios y Repositorios MongoDB
│       └── test/java/          # Suites de pruebas unitarias (JUnit 5 y Mockito)
└── frontend/                   # Cliente Móvil Multiplataforma (React Native)
    ├── package.json            # Scripts de ejecución (Expo, Jest) y dependencias
    ├── utils/                  # Componentes de transformación terminológica y FHIR
    └── __tests__/              # Suite de pruebas automatizadas en entorno de test
```
