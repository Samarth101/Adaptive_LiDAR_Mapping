import re

with open("Frontend/app/components/LidarViewer.tsx", "r") as f:
    content = f.read()

# Add sequence state
if "const [sequence, setSequence]" not in content:
    content = content.replace(
        "const [availableModels, setAvailableModels] = useState<string[]>(['pointnet2', 'cylinder3d', 'minkunet']);",
        "const [availableModels, setAvailableModels] = useState<string[]>(['pointnet2', 'cylinder3d', 'minkunet']);\n  const [sequence, setSequence] = useState<string>('00');\n  const availableSequences = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];"
    )

# Update ws.onopen
content = content.replace(
    'ws.send(JSON.stringify({ action: "start", model: model, sequence: "00" }));',
    'ws.send(JSON.stringify({ action: "start", model: model, sequence: sequence }));'
)

# Add useEffect for sequence change
if "action: 'start', sequence" not in content:
    content = content.replace(
        "  // Handle Model change for Live WS",
        """  // Handle Sequence change for Live WS
  useEffect(() => {
    if (mode === 'live' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'start', sequence, model }));
      setLiveFrame(null); // Clear old frame
    }
  }, [sequence]); // Removed mode from deps to avoid re-triggering

  // Handle Model change for Live WS"""
    )

# Add Sequence dropdown UI
if "setSequence(e.target.value)" not in content:
    content = content.replace(
        "{availableModels.map(m => (",
        """</select>
        )}
        
        {/* Sequence Selector */}
        {mode === 'live' && (
            <select 
                className="bg-background border border-border rounded-full px-3 py-1.5 text-sm"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
            >
                {availableSequences.map(s => (
                    <option key={s} value={s}>Seq {s}</option>
                ))}
            </select>
        )}
        
        {mode === 'live' && false && (
            <select>{availableModels.map(m => ("""
    )
    # Wait, the above replace was a bit hacky. Let's do it better.

with open("Frontend/app/components/LidarViewer.tsx", "w") as f:
    f.write(content)
