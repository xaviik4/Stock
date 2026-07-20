import sqlite3
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import datetime

# Spotify API setup
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
    scope="user-library-read user-read-recently-played user-follow-read user-read-private",
    client_id="2a5fc14c706b4863965ea8f94e1f130d",
    client_secret="1ae6eb9cbc7f47a0986d3c8f7f3ff5ee",
    redirect_uri='http://localhost:8888/callback'
))

# --- DATABASE FUNCTIONS ---

def create_tables():
    conn = sqlite3.connect('music_data.db')
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS artists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            artist_id TEXT NOT NULL,
            FOREIGN KEY (artist_id) REFERENCES artists (id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            album_id TEXT NOT NULL,
            FOREIGN KEY (album_id) REFERENCES albums (id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS plays (
            track_id TEXT PRIMARY KEY,
            play_count INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (track_id) REFERENCES tracks (id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS plays_log (
            track_id TEXT NOT NULL,
            played_at TEXT NOT NULL,
            PRIMARY KEY (track_id, played_at),
            FOREIGN KEY (track_id) REFERENCES tracks (id)
        )
    ''')

    conn.commit()
    conn.close()

def insert_artist(artist_id, name):
    with sqlite3.connect('music_data.db') as conn:
        conn.execute('INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)', (artist_id, name))

def insert_album(album_id, name, artist_id):
    with sqlite3.connect('music_data.db') as conn:
        conn.execute('INSERT OR IGNORE INTO albums (id, name, artist_id) VALUES (?, ?, ?)', (album_id, name, artist_id))

def insert_track(track_id, name, album_id):
    with sqlite3.connect('music_data.db') as conn:
        conn.execute('INSERT OR IGNORE INTO tracks (id, name, album_id) VALUES (?, ?, ?)', (track_id, name, album_id))

def insert_play(track_id, played_at):
    with sqlite3.connect('music_data.db') as conn:
        c = conn.cursor()

        # Check if this play is already logged
        c.execute('SELECT 1 FROM plays_log WHERE track_id = ? AND played_at = ?', (track_id, played_at))
        if c.fetchone():
            return  # Skip duplicate

        # Log the play
        c.execute('INSERT INTO plays_log (track_id, played_at) VALUES (?, ?)', (track_id, played_at))

        # Update or insert into play count
        c.execute('SELECT play_count FROM plays WHERE track_id = ?', (track_id,))
        row = c.fetchone()
        if row:
            new_count = row[0] + 1
            c.execute('UPDATE plays SET play_count = ? WHERE track_id = ?', (new_count, track_id))
        else:
            c.execute('INSERT INTO plays (track_id, play_count) VALUES (?, ?)', (track_id, 1))

def print_db_contents():
    conn = sqlite3.connect('music_data.db')
    c = conn.cursor()

    print("\n--- Artists ---")
    for row in c.execute('SELECT * FROM artists'):
        print(row)

    print("\n--- Albums ---")
    for row in c.execute('SELECT * FROM albums'):
        print(row)

    print("\n--- Tracks ---")
    for row in c.execute('SELECT * FROM tracks'):
        print(row)

    print("\n--- Plays ---")
    c.execute('''
        SELECT tracks.name, artists.name, plays.play_count
        FROM plays
        JOIN tracks ON plays.track_id = tracks.id
        JOIN albums ON tracks.album_id = albums.id
        JOIN artists ON albums.artist_id = artists.id
    ''')
    for row in c.fetchall():
        print(f"Track: {row[0]}, Artist: {row[1]}, Play Count: {row[2]}")

    print("\n--- Plays Log (Recent Plays) ---")
    for row in c.execute('SELECT * FROM plays_log ORDER BY played_at DESC LIMIT 10'):
        print(row)

    conn.close()

# --- FETCHING FROM SPOTIFY ---

def fetch_recent_tracks():
    results = sp.current_user_recently_played(limit=50)
    for item in results['items']:
        track = item['track']
        artist = track['artists'][0]
        album = track['album']
        played_at = item['played_at']  # ISO 8601 format

        artist_id = artist['id']
        album_id = album['id']
        track_id = track['id']

        insert_artist(artist_id, artist['name'])
        insert_album(album_id, album['name'], artist_id)
        insert_track(track_id, track['name'], album_id)
        insert_play(track_id, played_at)

# --- MAIN RUN ---
if __name__ == "__main__":
    create_tables()
    fetch_recent_tracks()
    print_db_contents()
