import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import RecordScreen from "./screens/RecordScreen";
import FormScreen from "./screens/FormScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Record">
        <Stack.Screen
          name="Record"
          component={RecordScreen}
          options={{ title: "EchoHealth - Grabar" }}
        />
        <Stack.Screen
          name="Form"
          component={FormScreen}
          options={{ title: "Datos Extraídos" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
