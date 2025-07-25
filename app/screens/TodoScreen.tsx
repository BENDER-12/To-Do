import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function TodoScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [todo, setTodo] = useState('');
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Google Auth Session
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '878090612223-07mci8f9tg8qsl2b15va8mi39igu1i2t.apps.googleusercontent.com', // Web client ID for Expo Go
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  // Handle Google sign-in response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((err) => {
        setError('Google sign-in failed: ' + err.message);
      });
    }
  }, [response]);

  useEffect(() => {
    if (!user) {
      setTodos([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'todos'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleSignUp = async () => {
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSignIn = async () => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const addTodo = async () => {
    if (!todo.trim()) return;
    await addDoc(collection(db, 'todos'), { title: todo, done: false, uid: user.uid });
    setTodo('');
  };

  const toggleDone = async (id: string, done: boolean) => {
    await updateDoc(doc(db, 'todos', id), { done: !done });
  };

  const removeTodo = async (id: string) => {
    Alert.alert(
      'Delete Todo',
      'Are you sure you want to delete this todo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'todos', id)) }
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>📝</Text>
        <Text style={styles.header}>Welcome to Todo App</Text>
        <TouchableOpacity style={[styles.button, styles.googleButton]} onPress={() => promptAsync()} disabled={!request}>
          <Text style={styles.buttonText}>Sign In with Google</Text>
        </TouchableOpacity>
        <Text style={styles.orText}>or</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSignUp}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.userHeader}>
        <Text style={styles.userIcon}>👤</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.signedInTop}>{user.email || user.displayName}</Text>
        </View>
        <TouchableOpacity style={[styles.button, styles.signOutButton, { width: 90, marginBottom: 0 }]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.logo}>📝</Text>
      <Text style={styles.header}>Todo List</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Add new todo"
          value={todo}
          onChangeText={setTodo}
        />
        <TouchableOpacity style={styles.addButton} onPress={addTodo} disabled={todo.trim() === ''}>
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={todos}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.todoItem}>
              <TouchableOpacity
                style={styles.todoTextContainer}
                onPress={() => toggleDone(item.id, item.done)}
              >
                <Text style={[styles.todoText, item.done && styles.done]}>
                  {item.done ? '✅ ' : '⬜ '} {item.title}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeTodo(item.id)}>
                <Text style={styles.deleteButton}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No todos yet. Add one!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#f8f9fa' },
  userHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, marginTop: 8, paddingHorizontal: 8 },
  userIcon: { fontSize: 32, marginRight: 10 },
  signedInTop: { fontWeight: 'bold', color: '#1976d2', fontSize: 16 },
  logo: { fontSize: 48, marginBottom: 8 },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#1976d2' },
  signedIn: { marginBottom: 8, color: '#333' },
  form: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginBottom: 8, width: 200, backgroundColor: '#fff' },
  button: { backgroundColor: '#1976d2', padding: 10, borderRadius: 6, marginBottom: 8, width: 200, alignItems: 'center' },
  googleButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1976d2', marginBottom: 8 },
  orText: { marginVertical: 8, color: '#888', fontWeight: 'bold' },
  secondaryButton: { backgroundColor: '#43a047' },
  signOutButton: { backgroundColor: '#e53935', marginBottom: 0 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  addButton: { backgroundColor: '#43a047', borderRadius: 20, padding: 10, marginLeft: 8 },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  todoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 300, paddingVertical: 8 },
  todoTextContainer: { flex: 1 },
  todoText: { fontSize: 18, color: '#222' },
  done: { textDecorationLine: 'line-through', color: '#888' },
  deleteButton: { fontSize: 20, color: '#e53935', marginLeft: 12 },
  separator: { height: 1, backgroundColor: '#eee', width: 300 },
  error: { color: 'red', marginTop: 8 },
  empty: { color: '#888', marginTop: 16, fontStyle: 'italic' },
});