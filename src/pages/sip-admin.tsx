import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { 
  setServers, 
  setPhones, 
  setUserSipConfigs, 
  setSelectedServer, 
  setCurrentCredentials 
} from '@/entities/WebRtc/model/slice';
import { apiClient } from '@/lib/api';

const SipAdmin = () => {
  const dispatch = useDispatch();
  const servers = useSelector((state: RootState) => state.sip.servers);
  const phones = useSelector((state: RootState) => state.sip.phones);
  const userSipConfigs = useSelector((state: RootState) => state.sip.userSipConfigs);
  const selectedServer = useSelector((state: RootState) => state.sip.selectedServer);

  const [newServer, setNewServer] = useState({ url: '', ip: '', port: '' });
  const [newPhone, setNewPhone] = useState({ server_id: '', number: '', active: true });
  const [newUserSip, setNewUserSip] = useState({ server_id: '', selected_phone_id: '', secret: '' });

  const loadData = async () => {
    try {
      const [serversResponse, phonesResponse, userSipResponse] = await Promise.all([
        apiClient.getServers(),
        apiClient.getPhones(),
        apiClient.getUserSipConfigs()
      ]);
      
      if (serversResponse.success && phonesResponse.success && userSipResponse.success) {
        dispatch(setServers(serversResponse.data || []));
        dispatch(setPhones(phonesResponse.data || []));
        dispatch(setUserSipConfigs(userSipResponse.data || []));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.createServer(newServer);
      if (response.success) {
        setNewServer({ url: '', ip: '', port: '' });
        loadData();
      }
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  const handleCreatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.createPhone({
        server_id: parseInt(newPhone.server_id),
        number: newPhone.number,
        active: newPhone.active
      });
      if (response.success) {
        setNewPhone({ server_id: '', number: '', active: true });
        loadData();
      }
    } catch (error) {
      console.error('Failed to create phone:', error);
    }
  };

  const handleCreateUserSip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.createUserSipConfig({
        server_id: parseInt(newUserSip.server_id),
        selected_phone_id: newUserSip.selected_phone_id ? parseInt(newUserSip.selected_phone_id) : undefined,
        secret: newUserSip.secret
      });
      if (response.success) {
        setNewUserSip({ server_id: '', selected_phone_id: '', secret: '' });
        loadData();
      }
    } catch (error) {
      console.error('Failed to create user SIP config:', error);
    }
  };

  const handleSelectServer = (server: any) => {
    dispatch(setSelectedServer(server));
    
    // Find user SIP config for this server
    const userConfig = userSipConfigs.find(config => config.server_id === server.id);
    if (userConfig) {
      dispatch(setCurrentCredentials({
        username: userConfig.phone_number || '11',
        password: userConfig.secret
      }));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">SIP Configuration Admin</h1>
      
      {/* Servers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Servers</h2>
        
        <form onSubmit={handleCreateServer} className="mb-4 p-4 border rounded">
          <h3 className="font-medium mb-2">Add New Server</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="URL"
              value={newServer.url}
              onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <input
              type="text"
              placeholder="IP"
              value={newServer.ip}
              onChange={(e) => setNewServer({ ...newServer, ip: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <input
              type="text"
              placeholder="Port"
              value={newServer.port}
              onChange={(e) => setNewServer({ ...newServer, port: e.target.value })}
              className="p-2 border rounded"
              required
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Add Server
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <div 
              key={server.id} 
              className={`p-4 border rounded cursor-pointer ${
                selectedServer?.id === server.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleSelectServer(server)}
            >
              <h3 className="font-medium">{server.url}</h3>
              <p className="text-sm text-gray-600">{server.ip}:{server.port}</p>
              {selectedServer?.id === server.id && (
                <span className="text-xs text-blue-600 font-medium">Selected</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phones Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Phones</h2>
        
        <form onSubmit={handleCreatePhone} className="mb-4 p-4 border rounded">
          <h3 className="font-medium mb-2">Add New Phone</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <select
              value={newPhone.server_id}
              onChange={(e) => setNewPhone({ ...newPhone, server_id: e.target.value })}
              className="p-2 border rounded"
              required
            >
              <option value="">Select Server</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>{server.url}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Phone Number"
              value={newPhone.number}
              onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })}
              className="p-2 border rounded"
              required
            />
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newPhone.active}
                onChange={(e) => setNewPhone({ ...newPhone, active: e.target.checked })}
                className="mr-2"
              />
              Active
            </label>
          </div>
          <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Add Phone
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {phones.map((phone) => (
            <div key={phone.id} className="p-4 border rounded">
              <h3 className="font-medium">{phone.number}</h3>
              <p className="text-sm text-gray-600">Server: {phone.server_url}</p>
              <span className={`text-xs px-2 py-1 rounded ${
                phone.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {phone.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* User SIP Configs Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">User SIP Configurations</h2>
        
        <form onSubmit={handleCreateUserSip} className="mb-4 p-4 border rounded">
          <h3 className="font-medium mb-2">Add New User SIP Config</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <select
              value={newUserSip.server_id}
              onChange={(e) => setNewUserSip({ ...newUserSip, server_id: e.target.value })}
              className="p-2 border rounded"
              required
            >
              <option value="">Select Server</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>{server.url}</option>
              ))}
            </select>
            <select
              value={newUserSip.selected_phone_id}
              onChange={(e) => setNewUserSip({ ...newUserSip, selected_phone_id: e.target.value })}
              className="p-2 border rounded"
            >
              <option value="">Select Phone (Optional)</option>
              {phones.map((phone) => (
                <option key={phone.id} value={phone.id}>{phone.number}</option>
              ))}
            </select>
            <input
              type="password"
              placeholder="Secret"
              value={newUserSip.secret}
              onChange={(e) => setNewUserSip({ ...newUserSip, secret: e.target.value })}
              className="p-2 border rounded"
              required
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
            Add User SIP Config
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userSipConfigs.map((config) => (
            <div key={config.id} className="p-4 border rounded">
              <h3 className="font-medium">Config #{config.id}</h3>
              <p className="text-sm text-gray-600">Server: {config.server_url}</p>
              <p className="text-sm text-gray-600">Phone: {config.phone_number || 'Not set'}</p>
              <p className="text-sm text-gray-600">Secret: {config.secret.substring(0, 4)}...</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SipAdmin;
