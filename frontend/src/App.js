import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Textarea } from './components/ui/textarea';
import { Users, Trophy, Zap, Settings, Play, Square, Crown, Gift, WifiOff, Wifi, Download, Coins, MessageCircle, RotateCcw } from 'lucide-react';
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
  const [streamerName, setStreamerName] = useState('');
  const [isGiveawayMode, setIsGiveawayMode] = useState(true);
  
  // Wheel of Fortune
  const [wheelItems, setWheelItems] = useState([]);
  const [wheelInput, setWheelInput] = useState('');
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [wheelWinner, setWheelWinner] = useState(null);
  const [showWheelAnimation, setShowWheelAnimation] = useState(false);
  
  // Coin flip
  const [coinResult, setCoinResult] = useState(null);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const wheelRef = useRef(null);

  // Извлечение названия канала из URL
  const extractChannelName = (url) => {
    try {
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
  const connectToTwitchChat = (channelName, giveawayMode = true) => {
    try {
      setConnectionStatus('connecting');
      setChatMessages([{
        id: 'system-' + Date.now(),
        username: 'ЛУДИК БОТ',
        message: `🔌 Подключаемся к каналу ${channelName}...`,
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
      }]);

      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to Twitch IRC');
        
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan12345');
        ws.send(`JOIN #${channelName}`);
        
        setConnectionStatus('connected');
        setIsConnected(true);
        
        const modeText = giveawayMode ? `Розыгрыш активен! Пишите "${keyword}"` : 'Просто читаем чат';
        setChatMessages(prev => [...prev, {
          id: 'system-' + Date.now(),
          username: 'ЛУДИК БОТ',
          message: `✅ Подключено к каналу ${channelName}! ${modeText}`,
          timestamp: new Date().toLocaleTimeString(),
          isSystem: true
        }]);
      };

      ws.onmessage = (event) => {
        const message = event.data.trim();
        console.log('Twitch IRC message:', message);
        
        if (message.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          return;
        }
        
        const chatMatch = message.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)/);
        if (chatMatch) {
          const [, username, messageText] = chatMatch;
          const isKeywordMessage = giveawayMode && messageText.toLowerCase().includes(keyword.toLowerCase());
          
          const newMessage = {
            id: 'real-' + Date.now() + '-' + Math.random(),
            username: username,
            message: messageText,
            timestamp: new Date().toLocaleTimeString(),
            isKeyword: isKeywordMessage,
            isSystem: false
          };

          setChatMessages(prev => [...prev.slice(-49), newMessage]);
          
          if (isKeywordMessage && !participants.includes(username)) {
            setParticipants(prev => [...prev, username]);
            
            setChatMessages(prev => [...prev, {
              id: 'participant-' + Date.now(),
              username: 'ЛУДИК БОТ',
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
          username: 'ЛУДИК БОТ',
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
          username: 'ЛУДИК БОТ',
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

  // Обновление названия стримера при изменении URL
  useEffect(() => {
    if (streamUrl.trim()) {
      const channel = extractChannelName(streamUrl.trim());
      if (channel) {
        setStreamerName(channel.charAt(0).toUpperCase() + channel.slice(1));
      }
    } else {
      setStreamerName('');
    }
  }, [streamUrl]);

  const startListening = (giveawayMode = true) => {
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
    setIsGiveawayMode(giveawayMode);
    connectToTwitchChat(channel, giveawayMode);
    
    const modeText = giveawayMode ? `🎉 Розыгрыш начался! Пишите "${keyword}" в чате для участия!` : '💬 Подключились к чату для просмотра сообщений';
    setChatMessages([{
      id: 'start-' + Date.now(),
      username: 'ЛУДИК БОТ',
      message: modeText,
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
    setIsGiveawayMode(true);
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
    
    setTimeout(() => {
      setShowWinnerAnimation(false);
    }, 5000);

    setChatMessages(prev => [...prev, {
      id: 'winner-' + Date.now(),
      username: 'ЛУДИК БОТ',
      message: `🏆 Поздравляем ${selectedWinner}! Вы выиграли!`,
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    }]);
  };

  const clearParticipants = () => {
    setParticipants([]);
    setWinner(null);
  };

  const exportParticipants = () => {
    if (participants.length === 0) {
      alert('Нет участников для экспорта!');
      return;
    }

    const data = participants.map((participant, index) => `${index + 1}. ${participant}`).join('\n');
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants_${channelName}_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Wheel of Fortune functions
  const addToWheel = () => {
    if (wheelInput.trim()) {
      setWheelItems([...wheelItems, wheelInput.trim()]);
      setWheelInput('');
    }
  };

  const handleWheelKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (wheelInput.trim()) {
        setWheelItems([...wheelItems, wheelInput.trim()]);
        setWheelInput('');
      }
    }
  };

  const removeFromWheel = (index) => {
    setWheelItems(wheelItems.filter((_, i) => i !== index));
  };

  const spinWheel = () => {
    if (wheelItems.length === 0) {
      alert('Добавьте варианты в колесо!');
      return;
    }

    setIsWheelSpinning(true);
    const randomIndex = Math.floor(Math.random() * wheelItems.length);
    const selectedItem = wheelItems[randomIndex];
    
    // Симулируем вращение
    setTimeout(() => {
      setWheelWinner(selectedItem);
      setIsWheelSpinning(false);
      setShowWheelAnimation(true);
      
      setTimeout(() => {
        setShowWheelAnimation(false);
      }, 3000);
    }, 2000);
  };

  // Coin flip functions
  const flipCoin = () => {
    setIsFlippingCoin(true);
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    
    setTimeout(() => {
      setCoinResult(result);
      setIsFlippingCoin(false);
      setShowCoinAnimation(true);
      
      setTimeout(() => {
        setShowCoinAnimation(false);
      }, 3000);
    }, 1500);
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

      {/* Wheel Winner Animation */}
      {showWheelAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <RotateCcw className="w-24 h-24 mx-auto text-purple-400 mb-4 animate-spin" />
            <h1 className="text-5xl font-bold text-white mb-4 animate-pulse">🎯 КОЛЕСО РЕШИЛО!</h1>
            <h2 className="text-4xl font-bold text-purple-400 mb-8">{wheelWinner}</h2>
          </div>
        </div>
      )}

      {/* Coin Animation */}
      {showCoinAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <Coins className="w-24 h-24 mx-auto text-yellow-400 mb-4 animate-spin" />
            <h1 className="text-5xl font-bold text-white mb-4 animate-pulse">🪙 МОНЕТКА РЕШИЛА!</h1>
            <h2 className="text-4xl font-bold text-yellow-400 mb-8">
              {coinResult === 'heads' ? '👑 ОРЁЛ' : '🕊️ РЕШКА'}
            </h2>
          </div>
        </div>
      )}

      <div className="container mx-auto p-6">
        {/* Dynamic Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Gift className="w-12 h-12 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">
              {streamerName ? `Главарь Тусовки ${streamerName}` : 'ЛУДИК БОТ'}
            </h1>
            <Trophy className="w-12 h-12 text-yellow-400" />
          </div>
          <p className="text-gray-300 text-lg">Твой помощник для розыгрышей и развлечений на стриме</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
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
                    Ключевое слово для розыгрыша
                  </label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="!участвую"
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <Separator className="bg-gray-600" />

                <div className={`flex items-center gap-2 ${getConnectionStatusColor()}`}>
                  {getConnectionStatusIcon()}
                  <span className="text-sm">{getConnectionStatusText()}</span>
                  {channelName && (
                    <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                      #{channelName}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {!isConnected ? (
                    <>
                      <Button
                        onClick={() => startListening(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={connectionStatus === 'connecting'}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {connectionStatus === 'connecting' ? 'Подключение...' : 'Розыгрыш'}
                      </Button>
                      <Button
                        onClick={() => startListening(false)}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        disabled={connectionStatus === 'connecting'}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Просто чат
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={stopListening}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Стоп
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Participants */}
            {isGiveawayMode && (
              <Card className="bg-gray-900 border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Участники ({participants.length})
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={exportParticipants}
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      disabled={participants.length === 0}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Экспорт
                    </Button>
                    <Button
                      onClick={clearParticipants}
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      Очистить
                    </Button>
                  </div>
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
            )}

            {/* Coin Flip */}
            <Card className="bg-gray-900 border-gray-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                Монетка
              </h3>
              <Button
                onClick={flipCoin}
                disabled={isFlippingCoin}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold"
              >
                <Coins className={`w-4 h-4 mr-2 ${isFlippingCoin ? 'animate-spin' : ''}`} />
                {isFlippingCoin ? 'Подбрасываю...' : 'Подбросить монетку'}
              </Button>
              {coinResult && !showCoinAnimation && (
                <div className="mt-3 text-center text-lg font-bold">
                  {coinResult === 'heads' ? '👑 ОРЁЛ' : '🕊️ РЕШКА'}
                </div>
              )}
            </Card>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2 space-y-6">
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
                  {isConnected && !isGiveawayMode && (
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      Просто чат
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
                  <p className="text-lg mb-2">Подключите чат для начала</p>
                  <p className="text-sm">Введите ссылку на стрим и выберите режим</p>
                  <div className="mt-4 text-xs text-gray-600">
                    <p>Поддерживаемые форматы:</p>
                    <p>• https://twitch.tv/channelname</p>
                    <p>• channelname</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Wheel of Fortune */}
            <Card className="bg-gray-900 border-gray-700 p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <RotateCcw className="w-6 h-6 text-purple-400" />
                Колесо Фортуны
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Добавить варианты (Enter для следующего)
                  </label>
                  <Textarea
                    value={wheelInput}
                    onChange={(e) => setWheelInput(e.target.value)}
                    onKeyPress={handleWheelKeyPress}
                    placeholder="Введите вариант и нажмите Enter..."
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 h-32 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={addToWheel}
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      disabled={!wheelInput.trim()}
                    >
                      Добавить
                    </Button>
                    <Button
                      onClick={() => setWheelItems([])}
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      disabled={wheelItems.length === 0}
                    >
                      Очистить все
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Варианты на колесе ({wheelItems.length})
                  </label>
                  <div className="bg-gray-800 border border-gray-600 rounded-md p-3 h-32 overflow-y-auto custom-scrollbar">
                    {wheelItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 mb-1 bg-gray-700 rounded text-sm"
                      >
                        <span className="text-white truncate">{item}</span>
                        <button
                          onClick={() => removeFromWheel(index)}
                          className="text-red-400 hover:text-red-300 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {wheelItems.length === 0 && (
                      <div className="text-center text-gray-500 text-sm">
                        Добавьте варианты для колеса
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={spinWheel}
                    disabled={wheelItems.length === 0 || isWheelSpinning}
                    className="w-full mt-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold"
                  >
                    <RotateCcw className={`w-4 h-4 mr-2 ${isWheelSpinning ? 'animate-spin' : ''}`} />
                    {isWheelSpinning ? 'Крутится...' : 'Крутить колесо!'}
                  </Button>
                  
                  {wheelWinner && !showWheelAnimation && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500 rounded-lg text-center">
                      <div className="text-sm text-gray-300">Колесо выбрало:</div>
                      <div className="text-lg font-bold text-purple-400">{wheelWinner}</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-gray-700">
          <p className="text-gray-400 text-sm">by @TRAVISPERKIIINS &lt;3</p>
        </div>
      </div>
    </div>
  );
}

export default App;