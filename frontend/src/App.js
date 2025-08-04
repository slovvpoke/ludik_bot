import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Users, Trophy, Zap, Settings, Play, Square, Crown, Gift, WifiOff, Wifi } from 'lucide-react';
import './App.css';

function App() {
  const [streamUrl, setStreamUrl] = useState('');
  const [keyword, setKeyword] = useState('!участвую');
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [winner, setWinner] = useState(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [channelName, setChannelName] = useState('');
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);

  // Извлечение названия канала из URL
  const extractChannelName = (url) => {
    try {
      // Поддерживаем различные форматы URL
      const patterns = [
        /twitch\.tv\/(\w+)$/,
        /twitch\.tv\/(\w+)\/?$/,
        /www\.twitch\.tv\/(\w+)$/,
        /www\.twitch\.tv\/(\w+)\/?$/,
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1].toLowerCase();
        }
      }
      
      // Если это просто название канала
      if (/^\w+$/.test(url)) {
        return url.toLowerCase();
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting channel name:', error);
      return null;
    }
  };

  // Подключение к Twitch IRC через WebSocket
  const connectToTwitchChat = (channelName) => {
    try {
      setConnectionStatus('connecting');
      setChatMessages([{
        id: 'system-' + Date.now(),
        username: 'TwitchBot',
        message: `🔌 Подключаемся к каналу ${channelName}...`,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
      }]);

      // Создаем WebSocket соединение с Twitch IRC
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to Twitch IRC');
        
        // Отправляем команды для подключения к IRC
        ws.send('PASS SCHMOOPIIE'); // Анонимное подключение
        ws.send('NICK justinfan12345'); // Анонимный пользователь
        ws.send(`JOIN #${channelName}`); // Присоединяемся к каналу
        
        setConnectionStatus('connected');
        setIsConnected(true);
        
        setChatMessages(prev => [...prev, {
          id: 'system-' + Date.now(),
          username: 'TwitchBot',
          message: `✅ Подключено к каналу ${channelName}! Ожидаем сообщения...`,
          timestamp: new Date().toLocaleTimeString(),
          isSystem: true
        }]);
      };

      ws.onmessage = (event) => {
        const message = event.data.trim();
        console.log('Twitch IRC message:', message);
        
        // Обработка PING/PONG для поддержания соединения
        if (message.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          return;
        }
        
        // Парсинг сообщений чата
        const chatMatch = message.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        if (chatMatch) {
          const [, username, messageText] = chatMatch;
          const isKeywordMessage = messageText.toLowerCase().includes(keyword.toLowerCase());
          
          const newMessage = {
            id: 'real-' + Date.now() + '-' + Math.random(),
            username: username,
            message: messageText,
            timestamp: new Date().toLocaleTimeString(),
            isKeyword: isKeywordMessage,
            isSystem: false
          };

          setChatMessages(prev => [...prev.slice(-49), newMessage]);
          
          // Добавляем участника если написал ключевое слово
          if (isKeywordMessage && !participants.includes(username)) {
            setParticipants(prev => [...prev, username]);
            
            // Добавляем уведомление о новом участнике
            setChatMessages(prev => [...prev, {
              id: 'participant-' + Date.now(),
              username: 'TwitchBot',
              message: `🎯 ${username} присоединился к розыгрышу!`,
              timestamp: new Date().toLocaleTimeString(),
              isSystem: true
            }]);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setChatMessages(prev => [...prev, {
          id: 'error-' + Date.now(),
          username: 'TwitchBot',
          message: '❌ Ошибка подключения к чату Twitch',
          timestamp: new Date().toLocaleTimeString(),
          isSystem: true
        }]);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setChatMessages(prev => [...prev, {
          id: 'disconnect-' + Date.now(),
          username: 'TwitchBot',
          message: '🔌 Отключено от чата',
          timestamp: new Date().toLocaleTimeString(),
          isSystem: true
        }]);
      };

    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      setConnectionStatus('error');
    }
  };

  // Автоскролл чата
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startListening = () => {
    if (!streamUrl.trim()) {
      alert('Введите ссылку на стрим или название канала!');
      return;
    }

    const channel = extractChannelName(streamUrl.trim());
    if (!channel) {
      alert('Неверный формат ссылки! Примеры:\n- https://twitch.tv/channelname\n- https://www.twitch.tv/channelname\n- channelname');
      return;
    }

    setChannelName(channel);
    connectToTwitchChat(channel);
    
    setChatMessages([{
      id: 'start-' + Date.now(),
      username: 'TwitchBot',
      message: `🎉 Розыгрыш начался! Пишите "${keyword}" в чате для участия!`,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    }]);
  };

  const stopListening = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnectionStatus('disconnected');
    setIsConnected(false);
  };

  const selectWinner = () => {
    if (participants.length === 0) {
      alert('Нет участников для розыгрыша!');
      return;
    }

    const randomIndex = Math.floor(Math.random() * participants.length);
    const selectedWinner = participants[randomIndex];
    
    setWinner(selectedWinner);
    setShowWinnerAnimation(true);
    
    // Убираем анимацию через 5 секунд
    setTimeout(() => {
      setShowWinnerAnimation(false);
    }, 5000);

    // Добавляем сообщение о победителе в чат
    setChatMessages(prev => [...prev, {
      id: 'winner-' + Date.now(),
      username: 'TwitchBot',
      message: `🏆 Поздравляем ${selectedWinner}! Вы выиграли!`,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    }]);
  };

  const clearParticipants = () => {
    setParticipants([]);
    setWinner(null);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Подключено к чату';
      case 'connecting': return 'Подключение...';
      case 'error': return 'Ошибка подключения';
      default: return 'Не подключено';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'connecting': return <Zap className="w-4 h-4 animate-pulse" />;
      case 'error': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-purple-800">
      {/* Winner Animation Overlay */}
      {showWinnerAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <Crown className="w-24 h-24 mx-auto text-yellow-400 mb-4 animate-spin" />
            <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">🎉 ПОБЕДИТЕЛЬ! 🎉</h1>
            <h2 className="text-4xl font-bold text-yellow-400 mb-8">{winner}</h2>
            <div className="text-2xl text-white">Поздравляем с победой!</div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Gift className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Twitch Розыгрыш</h1>
            <Trophy className="w-12 h-12 text-yellow-400" />
          </div>
          <p className="text-gray-300 text-lg">Реальные розыгрыши призов для вашего стрима</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900 border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-purple-400" />
                Настройки
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Ссылка на стрим или название канала
                  </label>
                  <Input
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://twitch.tv/channelname или channelname"
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Примеры: ninja, shroud, https://twitch.tv/ninja
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Ключевое слово для участия
                  </label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="!участвую"
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <Separator className="bg-gray-600" />

                {/* Connection Status */}
                <div className={`flex items-center gap-2 ${getConnectionStatusColor()}`}>
                  {getConnectionStatusIcon()}
                  <span className="text-sm">{getConnectionStatusText()}</span>
                  {channelName && (
                    <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                      #{channelName}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button
                      onClick={startListening}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={connectionStatus === 'connecting'}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {connectionStatus === 'connecting' ? 'Подключение...' : 'Начать'}
                    </Button>
                  ) : (
                    <Button
                      onClick={stopListening}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Стоп
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Participants */}
            <Card className="bg-gray-900 border-gray-700 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Участники ({participants.length})
                </h3>
                <Button
                  onClick={clearParticipants}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Очистить
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                {participants.map((participant, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg animate-fadeIn"
                  >
                    <Badge variant="outline" className="border-purple-500 text-purple-400">
                      {index + 1}
                    </Badge>
                    <span className="text-white">{participant}</span>
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Участников пока нет</p>
                    <p className="text-xs">Ждем сообщения с ключевым словом</p>
                  </div>
                )}
              </div>

              {participants.length > 0 && (
                <Button
                  onClick={selectWinner}
                  className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Выбрать победителя! ({participants.length})
                </Button>
              )}

              {winner && !showWinnerAnimation && (
                <div className="mt-4 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-lg">
                  <div className="text-center">
                    <Crown className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
                    <div className="text-sm text-gray-300">Последний победитель:</div>
                    <div className="text-lg font-bold text-yellow-400">{winner}</div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-700 p-6 h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  💬 Чат Twitch
                  {isConnected && (
                    <Badge className="bg-green-600 text-white animate-pulse">LIVE</Badge>
                  )}
                  {channelName && (
                    <Badge variant="outline" className="border-purple-500 text-purple-400">
                      #{channelName}
                    </Badge>
                  )}
                </h2>
                
                <div className={`flex items-center gap-2 ${getConnectionStatusColor()}`}>
                  {getConnectionStatusIcon()}
                  <span className="text-sm">{getConnectionStatusText()}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg animate-slideIn ${
                      msg.isSystem 
                        ? 'bg-blue-900/50 border border-blue-500' 
                        : msg.isKeyword 
                          ? 'bg-purple-900/50 border border-purple-500' 
                          : 'bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          msg.isSystem ? 'border-blue-400 text-blue-400' : 'border-gray-500 text-gray-400'
                        }`}
                      >
                        {msg.username}
                      </Badge>
                      <span className="text-xs text-gray-500">{msg.timestamp}</span>
                      {msg.isKeyword && (
                        <Badge className="bg-purple-600 text-white text-xs animate-pulse">
                          Участник!
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm ${
                      msg.isSystem ? 'text-blue-300 font-semibold' : 'text-white'
                    }`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {!isConnected && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">🔌</div>
                  <p className="text-lg mb-2">Подключите чат для начала розыгрыша</p>
                  <p className="text-sm">Введите ссылку на стрим и нажмите "Начать"</p>
                  <div className="mt-4 text-xs text-gray-600">
                    <p>Поддерживаемые форматы:</p>
                    <p>• https://twitch.tv/channelname</p>
                    <p>• channelname</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;