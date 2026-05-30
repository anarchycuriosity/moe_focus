import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { MainTabs } from './src/navigation/MainTabs'

export default function App(): JSX.Element
{
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <MainTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
