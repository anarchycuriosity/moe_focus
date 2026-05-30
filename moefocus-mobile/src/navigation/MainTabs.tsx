import { Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { TodayScreen } from '../screens/TodayScreen'
import { FocusScreen } from '../screens/FocusScreen'
import { StatsScreen } from '../screens/StatsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { moe_colors } from '../styles/theme'

const Tab = createBottomTabNavigator()

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }): JSX.Element
{
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  )
}

export function MainTabs(): JSX.Element
{
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: moe_colors.pink_dark,
        tabBarInactiveTintColor: moe_colors.text_light,
        tabBarStyle: {
          backgroundColor: moe_colors.white,
          borderTopColor: moe_colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500'
        },
        headerStyle: {
          backgroundColor: moe_colors.cream,
          shadowColor: 'transparent',
          borderBottomColor: moe_colors.border,
          borderBottomWidth: 1
        },
        headerTitleStyle: {
          color: moe_colors.text,
          fontSize: 17,
          fontWeight: '600'
        }
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: '今日',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
          headerTitle: '🌸 MoeFocus'
        }}
      />
      <Tab.Screen
        name="Focus"
        component={FocusScreen}
        options={{
          title: '专注',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
          headerTitle: '专注模式'
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: '统计',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          headerTitle: '统计'
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '设置',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
          headerTitle: '设置'
        }}
      />
    </Tab.Navigator>
  )
}
