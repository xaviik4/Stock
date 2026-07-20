# followed_artist_releases_gui.py
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import ttkbootstrap as tb
from tkinter import ttk
from datetime import datetime
import webbrowser

# Spotify API setup
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
    scope="user-follow-read",
    client_id="2a5fc14c706b4863965ea8f94e1f130d",
    client_secret="1ae6eb9cbc7f47a0986d3c8f7f3ff5ee",
    redirect_uri='http://localhost:8888/callback'
))

CURRENT_YEAR = str(datetime.now().year)

def get_followed_artists():
    artists = []
    after = None
    while True:
        results = sp.current_user_followed_artists(limit=50, after=after)
        items = results['artists']['items']
        if not items:
            break
        for artist in items:
            artists.append((artist['name'], artist['id']))
        after = items[-1]['id'] if items else None
    return artists

def get_latest_releases(artist_id):
    releases = sp.artist_albums(artist_id, album_type='album,single,appears_on', limit=10)['items']
    seen = set()
    filtered = []

    for release in releases:
        release_date = release['release_date']
        if not release_date.startswith(CURRENT_YEAR):
            continue

        name = release['name']
        if name in seen:
            continue
        seen.add(name)

        filtered.append({
            'artist_name': sp.artist(artist_id)['name'],
            'name': name,
            'url': release['external_urls']['spotify'],
            'release_date': release_date
        })

    return filtered

def show_releases():
    output_box.delete(*output_box.get_children())
    followed = get_followed_artists()

    all_releases = []
    for name, artist_id in followed:
        all_releases.extend(get_latest_releases(artist_id))

    # Sort by most recent
    all_releases.sort(key=lambda x: x['release_date'], reverse=True)

    for release in all_releases:
        output_box.insert("", "end", values=(
            release['artist_name'],
            release['name'],
            release['release_date'],
            "🎵 Open"
        ), tags=(release['url'],))  # Store URL in the tag

def open_spotify_link(event):
    selected_item = output_box.focus()
    if selected_item:
        url = output_box.item(selected_item, "tags")[0]
        if url:
            webbrowser.open_new(url)

# --- GUI Setup ---
root = tb.Window(themename="flatly")
root.title(f"New Spotify Releases ({CURRENT_YEAR})")
root.geometry("960x520")

frame = tb.Frame(root)
frame.pack(pady=10)

refresh_button = tb.Button(frame, text="Fetch Releases", bootstyle="primary", command=show_releases)
refresh_button.pack()

output_box = ttk.Treeview(root, columns=("Artist", "Release", "Date", "Link"), show="headings", height=20)
output_box.heading("Artist", text="Artist")
output_box.heading("Release", text="Release")
output_box.heading("Date", text="Release Date")
output_box.heading("Link", text="Spotify")

output_box.column("Artist", width=200)
output_box.column("Release", width=250)
output_box.column("Date", width=100)
output_box.column("Link", width=100, anchor="center")

output_box.bind("<Double-1>", open_spotify_link)

output_box.pack(expand=True, fill="both", padx=20, pady=10)

root.mainloop()
