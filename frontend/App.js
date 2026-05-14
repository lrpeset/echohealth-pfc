import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import HomeScreen from "./screens/HomeScreen";
import HistoryScreen from "./screens/HistoryScreen";
import FormListScreen from "./screens/FormListScreen";
import FormDetailScreen from "./screens/FormDetailScreen";
import FormEditorScreen from "./screens/FormEditorScreen";
import RecordScreen from "./screens/RecordScreen";
import FormScreen from "./screens/FormScreen";
import ConsultationDetailScreen from "./screens/ConsultationDetailScreen";
import LoginScreen from "./screens/LoginScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function FormStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#F5F7FA" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="FormList"
        component={FormListScreen}
        options={{ title: "Mis Plantillas" }}
      />
      <Stack.Screen
        name="FormDetail"
        component={FormDetailScreen}
        options={{ title: "Plantilla" }}
      />
      <Stack.Screen
        name="FormEditor"
        component={FormEditorScreen}
        options={{ title: "Editor" }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "HomeTab") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "HistoryTab") {
            iconName = focused ? "folder" : "folder-outline";
          } else if (route.name === "FormTab") {
            iconName = focused ? "layers" : "layers-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#4CAF50",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60 },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: "Inicio" }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{ title: "Historial" }}
      />
      <Tab.Screen
        name="FormTab"
        component={FormStack}
        options={{ title: "Formularios", headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator initialRouteName="Login">
        
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ConsultationDetail"
          component={ConsultationDetailScreen}
          options={{
            title: "Detalle de Consulta",
            headerStyle: { backgroundColor: "#2C3E50" },
            headerTintColor: "#FFFFFF",
            headerShadowVisible: false,
          }}
        />

        <Stack.Group
          screenOptions={({ navigation }) => ({
            presentation: "modal",
            headerLeft: () => (
              <Ionicons
                name="close"
                size={28}
                color="#333"
                style={{ marginLeft: 15 }}
                onPress={() => navigation.goBack()}
              />
            ),
          })}
        >
          <Stack.Screen
            name="Record"
            component={RecordScreen}
            options={{
              title: "Nueva Consulta",
              headerStyle: { backgroundColor: "#f5f7fa" },
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="Form"
            component={FormScreen}
            options={{
              title: "Detalle Clínico",
              headerStyle: { backgroundColor: "#f5f7fa" },
              headerShadowVisible: false,
            }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
