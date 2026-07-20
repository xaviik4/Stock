import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt
import os
from discord_webhook import DiscordWebhook, DiscordEmbed
from sklearn.linear_model import LinearRegression
import numpy as np

plt.style.use('ggplot')  # Nice clean visual style

# Webhook URL from Discord (replace with your own)

# Define tickers
tickers = ["NVDA", "AAPL", "MSFT", "TSLA", "IBM", "BULL", "VOO", "VTI"]

# 📁 Folder to save charts
out_dir = "charts"
os.makedirs(out_dir, exist_ok=True)

# Function to fetch VIX data
def get_vix_data():
    vix = yf.download('^VIX', period='1y', interval='1d')
    return vix

# Iterate over each ticker
for ticker in tickers:
    stock = yf.Ticker(ticker)
    
    # Get historical data
    data_1y = stock.history(period="1y")
    if data_1y.empty or len(data_1y) < 50:
        print(f"⚠️ Not enough data for {ticker}, skipping.")
        continue

    data_1m = data_1y.tail(30)
    data_1w = data_1y.tail(7)
    if len(data_1w) < 2 or len(data_1m) < 2:
        print(f"⚠️ Not enough weekly/monthly data for {ticker}. Skipping.")
        continue

    # percentage change calculations
    change_1w = ((data_1w["Close"].iloc[-1] - data_1w["Close"].iloc[0]) / data_1w["Close"].iloc[0]) * 100
    change_1m = ((data_1m["Close"].iloc[-1] - data_1m["Close"].iloc[0]) / data_1m["Close"].iloc[0]) * 100
    change_1y = ((data_1y["Close"].iloc[-1] - data_1y["Close"].iloc[0]) / data_1y["Close"].iloc[0]) * 100

    # Add moving averages
    data_1y["MA20"] = data_1y["Close"].rolling(20).mean()
    data_1y["MA50"] = data_1y["Close"].rolling(50).mean()

    # Calculate RSI (Relative Strength Index)
    delta = data_1y["Close"].diff()
    gain = np.where(delta > 0, delta, 0)
    loss = np.where(delta < 0, -delta, 0)

    avg_gain = pd.Series(gain).rolling(window=14).mean()
    avg_loss = pd.Series(loss).rolling(window=14).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    data_1y["RSI"] = rsi.values

    # --- AI prediction ---
    data = data_1y.dropna()
    X = np.arange(len(data)).reshape(-1, 1)
    y = data["Close"].values
    model = LinearRegression().fit(X, y)

    future_index = np.arange(len(data), len(data)+5).reshape(-1, 1)
    future_prices = model.predict(future_index)

    # Grab last and next predicted price
    predicted_price = future_prices[-1]

    # Fetch VIX data
    vix_data = get_vix_data()

    # --- Plotting with Subplots ---
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 9), sharex=True, gridspec_kw={'height_ratios': [3, 1]})

    # Price & MA plot
    ax1.plot(data_1y.index, data_1y["Close"], label="1Y Trend", color='gray', alpha=0.6)
    ax1.plot(data_1m.index, data_1m["Close"], label="1M Trend", color='blue', linewidth=2)
    ax1.plot(data_1w.index, data_1w["Close"], label="1W Trend", color='red', linewidth=2.5)
    ax1.plot(data_1y.index, data_1y["MA20"], label="MA20", linestyle='--', color='green')
    ax1.plot(data_1y.index, data_1y["MA50"], label="MA50", linestyle='--', color='purple')
    ax1.set_ylabel("Price (USD)")
    ax1.set_title(f"{ticker} Stock Trend Overview", fontsize=16)
    ax1.legend()

    # RSI plot
    ax2.plot(data_1y.index, data_1y["RSI"], label="RSI (14)", color='orange')
    ax2.axhline(70, color='red', linestyle='--', linewidth=1)
    ax2.axhline(30, color='green', linestyle='--', linewidth=1)
    ax2.set_ylabel("RSI")
    ax2.set_xlabel("Date")
    ax2.set_ylim([0, 100])
    ax2.legend()

    # --- Add VIX plot as a secondary y-axis ---
    ax3 = ax1.twinx()  # Create a new axis for the VIX
    ax3.plot(vix_data.index, vix_data["Close"], label="VIX", color='red', alpha=0.5)
    ax3.set_ylabel("VIX", color='red')
    ax3.tick_params(axis='y', labelcolor='red')
    ax3.legend(loc='upper right')

    # Save chart to PNG
    image_path = os.path.join(out_dir, f"{ticker}_trend.png")
    plt.tight_layout()
    plt.savefig(image_path)
    plt.close()

    print(f"✅ Saved chart for {ticker} at {image_path}")

    # --- Discord Webhook ---
    webhook = DiscordWebhook(url=WEBHOOK_URL)

    with open(image_path, "rb") as f:
        webhook.add_file(file=f.read(), filename=f"{ticker}_trend.png")

    embed = DiscordEmbed(
        title=f"{ticker} Stock Trend Overview",
        description=f"Here's the latest trend analysis for {ticker}",
        color=0x1abc9c
    )

    # --- Color-coded % changes ---
    def format_change(label, val):
        emoji = "📈" if val >= 0 else "📉"
        return f"{emoji} {label}", f"{val:+.2f}%"

    for label, val in [("1W Change", change_1w), ("1M Change", change_1m), ("1Y Change", change_1y)]:
        field_name, field_value = format_change(label, val)
        embed.add_embed_field(name=field_name, value=field_value, inline=True)

    # --- AI prediction ---
    embed.add_embed_field(name="🔮 5-Day AI Prediction", value=f"${predicted_price:.2f}", inline=False)
    embed.set_image(url=f"attachment://{ticker}_trend.png")
    webhook.add_embed(embed)

    response = webhook.execute()
    print(f"🚀 Sent {ticker} chart to Discord with response: {response.status_code}")
