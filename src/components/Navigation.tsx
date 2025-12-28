import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
} from "lucide-react";

interface NavigationProps {
  onCommand: (command: string) => void;
}

export default function Navigation({ onCommand }: NavigationProps) {
  const [activeCommand, setActiveCommand] = useState<string | null>(null);

  const handleCommand = (command: string) => {
    setActiveCommand(command);
    onCommand(command);

    // Clear active state after animation
    setTimeout(() => setActiveCommand(null), 200);
  };

  const commands = [
    { id: "forward", label: "Forward", icon: ArrowUp, position: "top" },
    { id: "left", label: "Left", icon: ArrowLeft, position: "left" },
    { id: "stop", label: "Stop", icon: Square, position: "center" },
    { id: "right", label: "Right", icon: ArrowRight, position: "right" },
    { id: "backward", label: "Backward", icon: ArrowDown, position: "bottom" },
  ];

  const getButtonPosition = (position: string) => {
    switch (position) {
      case "top":
        return "col-start-2 row-start-1";
      case "left":
        return "col-start-1 row-start-2";
      case "center":
        return "col-start-2 row-start-2";
      case "right":
        return "col-start-3 row-start-2";
      case "bottom":
        return "col-start-2 row-start-3";
      default:
        return "";
    }
  };

  const getButtonStyle = (command: { id: string }) => {
    const isActive = activeCommand === command.id;
    const isStop = command.id === "stop";

    if (isStop) {
      return `${
        isActive ? "bg-red-600 scale-95" : "bg-red-500 hover:bg-red-600"
      } text-white shadow-lg hover:shadow-xl`;
    }

    return `${
      isActive ? "bg-blue-600 scale-95" : "bg-blue-500 hover:bg-blue-600"
    } text-white shadow-lg hover:shadow-xl`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Robot Navigation
        </h2>
        <p className="text-slate-600">Control your robot's movement</p>
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-3 grid-rows-3 gap-4 p-8">
        {commands.map((command) => {
          const Icon = command.icon;
          return (
            <button
              key={command.id}
              onClick={() => handleCommand(command.id)}
              className={`
                w-20 h-20 rounded-2xl flex items-center justify-center
                transition-all duration-200 font-semibold text-lg
                ${getButtonPosition(command.position)}
                ${getButtonStyle(command)}
              `}
              title={command.label}
            >
              <Icon className="w-8 h-8" />
            </button>
          );
        })}
      </div>

      {/* Command Status */}
      <div className="text-center">
        <div className="bg-slate-100 rounded-xl px-6 py-3 inline-block">
          <span className="text-slate-600 text-sm">
            {activeCommand ? (
              <>
                <span className="font-semibold text-blue-600">Executing:</span>{" "}
                {activeCommand.toUpperCase()}
              </>
            ) : (
              "Ready for commands"
            )}
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center max-w-md">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1 text-left">
            <li>• Use arrow buttons to move the robot</li>
            <li>• Red STOP button for emergency stop</li>
            <li>• Commands are sent via Firebase to ESP32</li>
            <li>• Check system status for connection</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
