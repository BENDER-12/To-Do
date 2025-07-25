import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Animated, Appearance } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const FILTERS = ['All', 'Active', 'Completed'];

export default function TodoScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [todo, setTodo] = useState('');
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [snackbar, setSnackbar] = useState<{ visible: boolean, message: string, undo?: () => void }>({ visible: false, message: '' });
  const deletedTodoRef = useRef<any>(null);

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

  // Add todo
  const addTodo = async () => {
    if (!todo.trim()) return;
    await addDoc(collection(db, 'todos'), { title: todo, done: false, uid: user.uid, created: serverTimestamp() });
    setTodo('');
  };

  // Edit todo
  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditText(title);
  };
  const saveEdit = async (id: string) => {
    await updateDoc(doc(db, 'todos', id), { title: editText });
    setEditingId(null);
    setEditText('');
  };

  // Toggle done
  const toggleDone = async (id: string, done: boolean) => {
    await updateDoc(doc(db, 'todos', id), { done: !done });
  };

  // Delete todo with undo
  const removeTodo = async (id: string) => {
    const todoToDelete = todos.find(t => t.id === id);
    deletedTodoRef.current = todoToDelete;
    await deleteDoc(doc(db, 'todos', id));
    setSnackbar({
      visible: true,
      message: 'Todo deleted',
      undo: async () => {
        if (deletedTodoRef.current) {
          await addDoc(collection(db, 'todos'), { ...deletedTodoRef.current, created: serverTimestamp() });
          setSnackbar({ visible: false, message: '' });
        }
      }
    });
  };

  // Mark all as done/undone
  const markAll = async (done: boolean) => {
    await Promise.all(
      todos.filter(t => t.done !== done).map(t => updateDoc(doc(db, 'todos', t.id), { done }))
    );
  };

  // Filtered todos
  const filteredTodos = todos.filter(t =>
    filter === 'All' ? true : filter === 'Active' ? !t.done : t.done
  ).sort((a, b) => (b.created?.seconds || 0) - (a.created?.seconds || 0));

  // Snackbar auto-hide
  useEffect(() => {
    if (snackbar.visible) {
      const timer = setTimeout(() => setSnackbar({ visible: false, message: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.visible]);

  // Theming
  const colorScheme = Appearance.getColorScheme();
  const isDark = colorScheme === 'dark';

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
        <TouchableOpacity style={styles.button} onPress={async () => {
          setError('');
          try { await signInWithEmailAndPassword(auth, email, password); } catch (e: any) { setError(e.message); }
        }}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={async () => {
          setError('');
          try { await createUserWithEmailAndPassword(auth, email, password); } catch (e: any) { setError(e.message); }
        }}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#222' }]}>
      <View style={styles.userHeader}>
        <Text style={styles.userIcon}>{user.photoURL ? <Text>🧑‍💻</Text> : '👤'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.signedInTop}>{user.displayName || user.email}</Text>
        </View>
        <TouchableOpacity style={[styles.button, styles.signOutButton, { width: 90, marginBottom: 0 }]} onPress={async () => await signOut(auth)}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.logo}>📝</Text>
      <Text style={styles.header}>Todo List</Text>
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
      <View style={styles.markAllRow}>
        <TouchableOpacity style={styles.markAllButton} onPress={() => markAll(true)}>
          <Text style={styles.markAllText}>Mark all as done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.markAllButton} onPress={() => markAll(false)}>
          <Text style={styles.markAllText}>Mark all as active</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Animated.View style={styles.todoCard}>
              <View style={styles.todoItem}>
                {editingId === item.id ? (
                  <>
                    <TextInput
                      style={styles.editInput}
                      value={editText}
                      onChangeText={setEditText}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => saveEdit(item.id)}>
                      <Text style={styles.saveEdit}>💾</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }}>
                      <Text style={styles.cancelEdit}>✖️</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.todoTextContainer}
                      onPress={() => toggleDone(item.id, item.done)}
                      onLongPress={() => startEdit(item.id, item.title)}
                    >
                      <Text style={[styles.todoText, item.done && styles.done]}>
                        {item.done ? '✅ ' : '⬜ '} {item.title}
                      </Text>
                      <Text style={styles.todoDate}>
                        {item.created?.seconds ? new Date(item.created.seconds * 1000).toLocaleString() : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeTodo(item.id)}>
                      <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No todos yet. Add one!</Text>}
        />
      )}
      {snackbar.visible && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
          {snackbar.undo && (
            <TouchableOpacity onPress={snackbar.undo}>
              <Text style={styles.snackbarUndo}>UNDO</Text>
            </TouchableOpacity>
          )}
        </View>
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
  filterRow: { flexDirection: 'row', marginBottom: 8 },
  filterButton: { padding: 8, borderRadius: 6, marginHorizontal: 4, backgroundColor: '#e3e3e3' },
  filterButtonActive: { backgroundColor: '#1976d2' },
  filterText: { color: '#1976d2', fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },
  form: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginBottom: 8, width: 200, backgroundColor: '#fff' },
  addButton: { backgroundColor: '#43a047', borderRadius: 20, padding: 10, marginLeft: 8 },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  markAllRow: { flexDirection: 'row', justifyContent: 'space-between', width: 300, marginBottom: 8 },
  markAllButton: { backgroundColor: '#e3e3e3', borderRadius: 6, padding: 6, marginHorizontal: 4 },
  markAllText: { color: '#1976d2', fontWeight: 'bold' },
  todoCard: { backgroundColor: '#fff', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 4 },
  todoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 300, paddingVertical: 8, paddingHorizontal: 8 },
  todoTextContainer: { flex: 1 },
  todoText: { fontSize: 18, color: '#222' },
  done: { textDecorationLine: 'line-through', color: '#888' },
  deleteButton: { fontSize: 20, color: '#e53935', marginLeft: 12 },
  separator: { height: 1, backgroundColor: '#eee', width: 300 },
  error: { color: 'red', marginTop: 8 },
  empty: { color: '#888', marginTop: 16, fontStyle: 'italic' },
  editInput: { borderWidth: 1, borderColor: '#1976d2', borderRadius: 4, padding: 6, width: 140, marginRight: 8, backgroundColor: '#fff' },
  saveEdit: { fontSize: 20, color: '#43a047', marginRight: 8 },
  cancelEdit: { fontSize: 20, color: '#e53935' },
  todoDate: { fontSize: 12, color: '#888', marginTop: 2 },
  snackbar: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#222', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  snackbarText: { color: '#fff', fontWeight: 'bold' },
  snackbarUndo: { color: '#43a047', fontWeight: 'bold', marginLeft: 16 },
  googleButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1976d2', marginBottom: 8 },
  orText: { marginVertical: 8, color: '#888', fontWeight: 'bold' },
  secondaryButton: { backgroundColor: '#43a047' },
  signOutButton: { backgroundColor: '#e53935', marginBottom: 0 },
  button: { backgroundColor: '#1976d2', padding: 10, borderRadius: 6, marginBottom: 8, width: 200, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});