import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "./screens/HomeScreen";
import RecordScreen from "./screens/RecordScreen";
import FormScreen from "./screens/FormScreen";
import HistoryScreen from "./screens/HistoryScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Panel de Control" }}
        />
        <Stack.Screen
          name="Record"
          component={RecordScreen}
          options={{ title: "Nueva Consulta" }}
        />
        <Stack.Screen
          name="Form"
          component={FormScreen}
          options={{ title: "Datos Extraídos" }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "Historial Clínico" }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}