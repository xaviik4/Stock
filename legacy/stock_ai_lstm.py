import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
from discord_webhook import DiscordWebhook, DiscordEmbed
from sklearn.preprocessing import MinMaxScaler
import torch
import torch.nn as nn
import requests
from io import BytesIO


webhook_url = "https://discord.com/api/webhooks/1359658404628660438/G1u6fF4QDtVJpxYY5noZrByfqSTs9MM9ZI-vlrLKjYVDTYVoWWNbgvx0tJMrQMia0Mis"  # Replace with your webhook URL


# 📁 Folder to save charts
out_dir = "charts"
os.makedirs(out_dir, exist_ok=True)

# Step 1: Download stock data
ticker = 'AAPL'
df = yf.download(ticker, start='2018-01-01', end='2025-04-01')
prices = df['Close'].values.reshape(-1, 1)

# Step 2: Normalize data
scaler = MinMaxScaler()
scaled = scaler.fit_transform(prices)

# Step 3: Create sequences
def create_sequences(data, seq_length):
    x, y = [], []
    for i in range(seq_length, len(data)):
        x.append(data[i-seq_length:i])
        y.append(data[i])
    return np.array(x), np.array(y)

seq_length = 60
x, y = create_sequences(scaled, seq_length)

# Step 4: Convert to tensors
X_tensor = torch.FloatTensor(x)
y_tensor = torch.FloatTensor(y)

# Step 5: Define LSTM model
class LSTM(nn.Module):
    def __init__(self, input_size=1, hidden_size=50, num_layers=2):
        super(LSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out

model = LSTM(hidden_size=128, num_layers=3) # used to have no parameters

loss_fn = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Step 6: Train
for epoch in range(100):  # epoch is iteration, days to use to train
    model.train()
    output = model(X_tensor)
    loss = loss_fn(output, y_tensor)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    print(f"Epoch {epoch+1}, Loss: {loss.item():.6f}")

# Step 7: Predict next day
model.eval()
last_seq = torch.FloatTensor(scaled[-seq_length:].reshape(1, seq_length, 1))
with torch.no_grad():
    pred = model(last_seq).item()
    pred_price = scaler.inverse_transform([[pred]])
    print(f"🔮 Predicted next closing price for {ticker}: ${pred_price[0][0]:.2f}")

# Step 8: Plot last 100 + prediction
actual = scaler.inverse_transform(scaled[-100:])
fig, ax = plt.subplots(figsize=(12, 6))
ax.plot(actual, label='Actual')
ax.scatter(100, pred_price[0][0], color='red', label='Predicted')
ax.set_title(f'{ticker} - LSTM Prediction (PyTorch)')
ax.set_xlabel('Days')
ax.set_ylabel('Price')
ax.legend()
ax.grid()

# Save chart to PNG
image_path = os.path.join(out_dir, f"{ticker}_trend.png")
plt.savefig(image_path)
plt.close()

print(f"✅ Saved chart for {ticker} at {image_path}")
print(f"📎 File exists: {os.path.exists(image_path)}")

# Get the Close price Series
close_1y = df['Close'].dropna()[-252:]

# Convert individual values to floats
price_now = close_1y.iloc[-1].item()  # Use .item() to extract scalar value
price_1w_ago = close_1y.iloc[-6].item()
price_1m_ago = close_1y.iloc[-22].item()
price_1y_ago = close_1y.iloc[0].item()


# Calculate percentage changes
change_1w = float((price_now - price_1w_ago) / price_1w_ago * 100)
change_1m = float((price_now - price_1m_ago) / price_1m_ago * 100)
change_1y = float((price_now - price_1y_ago) / price_1y_ago * 100)


# Prepare the Discord webhook
webhook = DiscordWebhook(url=webhook_url)

with open(image_path, "rb") as f:
    webhook.add_file(file=f.read(), filename=f"{ticker}_trend.png")

# Create embed with custom fields
embed = DiscordEmbed(
    title=f"{ticker} Stock Trend Overview",
    description=f"Here's the latest trend analysis for {ticker}",
    color=0x1abc9c
)
embed.add_embed_field(name="📊 1W Change", value=f"{change_1w:.2f}%", inline=True)
embed.add_embed_field(name="📆 1M Change", value=f"{change_1m:.2f}%", inline=True)
embed.add_embed_field(name="📅 1Y Change", value=f"{change_1y:.2f}%", inline=True)

# Add LSTM AI Prediction
embed.add_embed_field(name="🔮 Next-Day AI Prediction", value=f"${pred_price[0][0]:.2f}", inline=False)

embed.set_image(url=f"attachment://{ticker}_trend.png")
webhook.add_embed(embed)

# Send the webhook
response = webhook.execute()
print(f"🚀 Sent {ticker} chart to Discord with response: {response.status_code}")

