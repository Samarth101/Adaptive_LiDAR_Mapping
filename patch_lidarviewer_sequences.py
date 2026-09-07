with open("Frontend/app/components/LidarViewer.tsx", "r") as f:
    content = f.read()

# Replace sequence static list with dynamic state
content = content.replace(
    "const [availableSequences, setAvailableSequences] = useState<string[]>(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']);",
    "const [availableSequences, setAvailableSequences] = useState<any[]>([]);"
)
content = content.replace(
    "const availableSequences = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];",
    "const [availableSequences, setAvailableSequences] = useState<any[]>([]);"
)

# Add fetch for sequences inside the models useEffect
if "/api/sequences" not in content:
    content = content.replace(
        "      }).catch(e => console.error(\"Could not fetch models\", e));\n  }, []);",
        "      }).catch(e => console.error(\"Could not fetch models\", e));\n\n    fetch('http://localhost:8000/api/sequences')\n      .then(res => res.json())\n      .then(data => {\n        if (Array.isArray(data)) {\n          setAvailableSequences(data);\n          if (data.length > 0 && !data.find(s => s.id === sequence)) {\n            setSequence(data[0].id);\n          }\n        }\n      }).catch(e => console.error(\"Could not fetch sequences\", e));\n  }, []);"
    )

# Update Sequence dropdown rendering
content = content.replace(
    """                {availableSequences.map(s => (
                    <option key={s} value={s}>Seq {s}</option>
                ))}""",
    """                {availableSequences.map(s => (
                    <option key={s.id} value={s.id}>Seq {s.id} ({s.frame_count} frames)</option>
                ))}"""
)

with open("Frontend/app/components/LidarViewer.tsx", "w") as f:
    f.write(content)
