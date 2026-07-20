import spotipy
from spotipy.oauth2 import SpotifyOAuth
from datetime import datetime, timedelta
import smtplib
from email.message import EmailMessage

# Spotify API setup
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
    scope="user-follow-read",
    client_id="2a5fc14c706b4863965ea8f94e1f130d",
    client_secret="1ae6eb9cbc7f47a0986d3c8f7f3ff5ee",
    redirect_uri='http://localhost:8888/callback'
))

# Gmail credentials (Use app password if 2FA is enabled)
EMAIL_SENDER = 'gomezd.harry@gmail.com'
EMAIL_PASSWORD = 'atob kopu jlzu kiel'
EMAIL_RECEIVER = 'gomezd.harry+spotify_release@gmail.com'

def get_previous_month_range():
    today = datetime.today().replace(day=1)
    last_day_prev_month = today - timedelta(days=1)
    start = last_day_prev_month.replace(day=1).strftime('%Y-%m-%d')
    end = last_day_prev_month.strftime('%Y-%m-%d')
    return start, end

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

def get_releases_last_month(artist_id, start, end):
    releases = sp.artist_albums(artist_id, album_type='album,single,appears_on', limit=20)['items']
    seen = set()
    filtered = []

    for release in releases:
        release_date = release['release_date']
        try:
            # Match year-month-day only
            if len(release_date) == 4:
                continue
            elif len(release_date) == 7:
                release_date += '-01'

            if not (start <= release_date <= end):
                continue

            name = release['name']
            if name in seen:
                continue
            seen.add(name)

            filtered.append({
                'artist_name': sp.artist(artist_id)['name'],
                'name': name,
                'release_date': release_date,
                'url': release['external_urls']['spotify']
            })
        except:
            continue
    return filtered

def send_email(releases):
    if not releases:
        return

    message = EmailMessage()
    message['Subject'] = '🎧 Monthly Spotify Recap'
    message['From'] = EMAIL_SENDER
    message['To'] = EMAIL_RECEIVER

    body = 'Here are the new releases from the artists you follow (last month):\n\n'
    for r in releases:
        body += f"{r['artist_name']} - {r['name']} ({r['release_date']})\n{r['url']}\n\n"

    message.set_content(body)

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
        smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
        smtp.send_message(message)

def run_monthly_recap():
    start, end = get_previous_month_range()
    all_releases = []

    for name, artist_id in get_followed_artists():
        all_releases.extend(get_releases_last_month(artist_id, start, end))

    all_releases.sort(key=lambda x: x['release_date'], reverse=True)
    send_email(all_releases)

if __name__ == "__main__":
    run_monthly_recap()
