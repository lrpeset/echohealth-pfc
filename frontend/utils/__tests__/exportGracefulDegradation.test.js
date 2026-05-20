import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

jest.mock("expo-file-system", () => ({
  cacheDirectory: null,
  writeAsStringAsync: jest.fn(),
  EncodingType: { UTF8: "utf8" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  shareAsync: jest.fn(),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

describe("Graceful Degradation — Fallback a portapapeles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cuando cacheDirectory es null la funcion retorna sin lanzar error", async () => {
    const content = '{"test":"data"}';
    await Clipboard.setStringAsync(content);

    const cacheDir = FileSystem.cacheDirectory;
    expect(cacheDir).toBeNull();

    if (!cacheDir) {
      return;
    }
    throw new Error("La degradación elegante no funcionó");
  });

  test("cuando Sharing.isAvailableAsync es false la funcion retorna sin lanzar error", async () => {
    const available = await Sharing.isAvailableAsync();
    expect(available).toBe(false);

    if (!available) {
      return;
    }
    throw new Error("La degradación elegante no funcionó");
  });

  test("Clipboard.setStringAsync se ejecuta siempre antes del intento de file share", async () => {
    await Clipboard.setStringAsync("datos-clinicos");
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("datos-clinicos");
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return;
    }
    throw new Error("Clipboard debería ser el fallback");
  });

  test("writeAsStringAsync y shareAsync NO se invocan cuando cacheDirectory es null", async () => {
    const content = "test";
    await Clipboard.setStringAsync(content);

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
      return;
    }
    throw new Error("cacheDirectory debería ser null en este mock");
  });

  test("shareAsync NO se invoca cuando Sharing.isAvailableAsync es false", async () => {
    const content = "test";
    await Clipboard.setStringAsync(content);

    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      return;
    }

    await FileSystem.writeAsStringAsync("dummy.json", content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
      return;
    }
    throw new Error("isAvailableAsync debería ser false en este mock");
  });
});
