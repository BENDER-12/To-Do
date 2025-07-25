import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Animated, Appearance, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const FILTERS = ['All', 'Today', 'Upcoming'];

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
}
function isUpcoming(date: Date) {
  const now = new Date();
  return date > now && !isToday(date);
}

export default function TodoScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [todo, setTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDue, setEditDue] = useState('');
  const [snackbar, setSnackbar] = useState<{ visible: boolean, message: string, undo?: () => void }>({ visible: false, message: '' });
  const deletedTodoRef = useRef<any>(null);

  // Google Auth Session
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Web client ID for Expo Go
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

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
    await addDoc(collection(db, 'todos'), {
      title: todo,
      done: false,
      uid: user.uid,
      created: serverTimestamp(),
      due: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setTodo('');
    setDueDate('');
  };

  // Edit todo
  const startEdit = (id: string, title: string, due: string) => {
    setEditingId(id);
    setEditText(title);
    setEditDue(due || '');
  };
  const saveEdit = async (id: string) => {
    await updateDoc(doc(db, 'todos', id), { title: editText, due: editDue });
    setEditingId(null);
    setEditText('');
    setEditDue('');
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
  const filteredTodos = todos.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'All') return true;
    if (filter === 'Today' && t.due) return isToday(new Date(t.due));
    if (filter === 'Upcoming' && t.due) return isUpcoming(new Date(t.due));
    return false;
  }).sort((a, b) => (b.created?.seconds || 0) - (a.created?.seconds || 0));

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

  // Login Card
  if (!user) {
    return (
      <View style={styles.darkBg}>
        <View style={styles.loginCard}>
          <Text style={styles.header}>Welcome back</Text>
          <Text style={styles.subHeader}>Sign in to continue to your workspace</Text>
          <TouchableOpacity style={[styles.socialButton, styles.googleBtn]} onPress={() => promptAsync()} disabled={!request}>
            <Text style={styles.socialBtnText}>G Continue with Google</Text>
          </TouchableOpacity>
          <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.orText}>or continue with email</Text><View style={styles.divider} /></View>
          <TextInput
            style={styles.input}
            placeholder="Email or Username"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            placeholderTextColor="#aaa"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity style={styles.signInBtn} onPress={async () => {
            setError('');
            try { await signInWithEmailAndPassword(auth, email, password); } catch (e: any) { setError(e.message); }
          }}>
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
          <Text style={styles.signupText}>Don't have an account? <Text style={styles.signupLink} onPress={async () => {
            setError('');
            try { await createUserWithEmailAndPassword(auth, email, password); } catch (e: any) { setError(e.message); }
          }}>Sign up</Text></Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.darkBg, { paddingTop: 32 }]}>
      {/* User Info */}
      <View style={styles.userRow}>
        <Text style={styles.avatar}>{user.photoURL ? '🧑‍💻' : '👤'}</Text>
        <View>
          <Text style={styles.userName}>{user.displayName || user.email}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={async () => await signOut(auth)}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {/* Search and Tabs */}
      <TextInput
        style={styles.search}
        placeholder="Search tasks..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
      />
      <View style={styles.tabsRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.tabBtn, filter === f && styles.tabBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Todo List */}
      {loading ? (
        <ActivityIndicator size="large" color="#FFD600" />
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.todoCard}>
              <View style={styles.todoRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleDone(item.id, item.done)} onLongPress={() => startEdit(item.id, item.title, item.due)}>
                  <Text style={[styles.todoTitle, item.done && styles.todoDone]}>{item.title}</Text>
                  {item.due && <Text style={styles.todoDue}>Due: {new Date(item.due).toLocaleDateString()}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeTodo(item.id)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>
              {editingId === item.id && (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Edit task"
                  />
                  <TextInput
                    style={styles.editInput}
                    value={editDue}
                    onChangeText={setEditDue}
                    placeholder="YYYY-MM-DD"
                  />
                  <TouchableOpacity onPress={() => saveEdit(item.id)}>
                    <Text style={styles.saveEdit}>💾</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); setEditDue(''); }}>
                    <Text style={styles.cancelEdit}>✖️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No tasks yet. Add one!</Text>}
        />
      )}
      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          // Focus the add input or open a modal if you want
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
      {/* Snackbar */}
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
      {/* Add Todo Bar (fixed at bottom) */}
      <View style={styles.addBar}>
        <TextInput
          style={styles.addInput}
          placeholder="Add a new task"
          value={todo}
          onChangeText={setTodo}
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={styles.addInput}
          placeholder="Due date (YYYY-MM-DD)"
          value={dueDate}
          onChangeText={setDueDate}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addTodo} disabled={todo.trim() === ''}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  darkBg: { flex: 1, backgroundColor: '#181818', justifyContent: 'center', alignItems: 'center' },
  loginCard: { backgroundColor: '#232323', borderRadius: 16, padding: 32, width: 340, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subHeader: { color: '#aaa', marginBottom: 16 },
  socialButton: { width: '100%', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12 },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EA4335' },
  socialBtnText: { color: '#EA4335', fontWeight: 'bold', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 12 },
  divider: { flex: 1, height: 1, backgroundColor: '#333' },
  orText: { color: '#aaa', marginHorizontal: 8, fontWeight: 'bold', fontSize: 12 },
  input: { backgroundColor: '#181818', color: '#fff', borderWidth: 1, borderColor: '#444', borderRadius: 6, padding: 10, marginBottom: 12, width: 260 },
  signInBtn: { backgroundColor: '#FFD600', borderRadius: 8, padding: 12, width: '100%', alignItems: 'center', marginBottom: 8 },
  signInBtnText: { color: '#222', fontWeight: 'bold', fontSize: 16 },
  signupText: { color: '#aaa', marginTop: 8 },
  signupLink: { color: '#FFD600', fontWeight: 'bold' },
  error: { color: '#FF5252', marginTop: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16, paddingHorizontal: 16 },
  avatar: { fontSize: 36, marginRight: 12 },
  userName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userEmail: { color: '#aaa', fontSize: 12 },
  logoutBtn: { backgroundColor: '#232323', borderRadius: 8, padding: 8, marginLeft: 'auto' },
  logoutBtnText: { color: '#FFD600', fontWeight: 'bold' },
  search: { backgroundColor: '#232323', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 12, width: 320 },
  tabsRow: { flexDirection: 'row', marginBottom: 12, width: 320, justifyContent: 'space-between' },
  tabBtn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#232323', marginHorizontal: 2 },
  tabBtnActive: { backgroundColor: '#FFD600' },
  tabText: { color: '#fff', fontWeight: 'bold' },
  tabTextActive: { color: '#222' },
  todoCard: { backgroundColor: '#232323', borderRadius: 12, marginBottom: 10, padding: 12, width: 320, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  todoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todoTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  todoDone: { textDecorationLine: 'line-through', color: '#FFD600' },
  todoDue: { color: '#FFD600', fontSize: 12, marginTop: 2 },
  deleteBtn: { fontSize: 20, color: '#FF5252', marginLeft: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  editInput: { backgroundColor: '#181818', color: '#fff', borderWidth: 1, borderColor: '#FFD600', borderRadius: 6, padding: 8, width: 120, marginRight: 8 },
  saveEdit: { fontSize: 20, color: '#43a047', marginRight: 8 },
  cancelEdit: { fontSize: 20, color: '#FF5252' },
  empty: { color: '#aaa', marginTop: 16, fontStyle: 'italic', textAlign: 'center' },
  fab: { position: 'absolute', right: 30, bottom: 90, backgroundColor: '#FFD600', borderRadius: 30, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  fabIcon: { color: '#222', fontSize: 36, fontWeight: 'bold' },
  snackbar: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#232323', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  snackbarText: { color: '#fff', fontWeight: 'bold' },
  snackbarUndo: { color: '#FFD600', fontWeight: 'bold', marginLeft: 16 },
  addBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#232323', flexDirection: 'row', alignItems: 'center', padding: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  addInput: { backgroundColor: '#181818', color: '#fff', borderWidth: 1, borderColor: '#FFD600', borderRadius: 6, padding: 8, marginRight: 8, flex: 1 },
  addBtn: { backgroundColor: '#FFD600', borderRadius: 8, padding: 12 },
  addBtnText: { color: '#222', fontWeight: 'bold', fontSize: 16 },
});