import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ChefZimDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecommendationsReceived: (recommendations: any) => void;
}

interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

const questions: Question[] = [
  {
    id: "mood",
    title: "How are you feeling today?",
    subtitle: "Your mood helps us suggest the perfect dish",
    options: [
      { value: "happy", label: "Happy & Energetic", icon: "😊" },
      { value: "tired", label: "Tired & Need Energy", icon: "😴" },
      { value: "stressed", label: "Stressed & Need Comfort", icon: "😣" },
      { value: "adventurous", label: "Adventurous", icon: "🤩" },
      { value: "relaxed", label: "Relaxed & Chill", icon: "😌" },
    ],
  },
  {
    id: "craving",
    title: "What are you craving?",
    subtitle: "Tell us what sounds good right now",
    options: [
      { value: "something_savory", label: "Something Savory", icon: "🍖" },
      { value: "something_sweet", label: "Something Sweet", icon: "🍰" },
      { value: "something_spicy", label: "Something Spicy", icon: "🌶️" },
      { value: "something_fresh", label: "Something Fresh & Light", icon: "🥗" },
      { value: "comfort_food", label: "Comfort Food", icon: "🍲" },
      { value: "surprise_me", label: "Surprise Me!", icon: "🎲" },
    ],
  },
  {
    id: "day_type",
    title: "What kind of day is it?",
    subtitle: "This helps us match portion sizes and meal types",
    options: [
      { value: "workday", label: "Busy Workday", icon: "💼" },
      { value: "weekend", label: "Relaxing Weekend", icon: "🏖️" },
      { value: "special_occasion", label: "Special Occasion", icon: "🎉" },
      { value: "regular_day", label: "Just a Regular Day", icon: "📅" },
    ],
  },
  {
    id: "weather",
    title: "What's the weather like?",
    subtitle: "Weather affects what tastes best",
    options: [
      { value: "sunny", label: "Sunny & Hot", icon: "☀️" },
      { value: "cloudy", label: "Cloudy & Mild", icon: "⛅" },
      { value: "cold", label: "Cold", icon: "❄️" },
      { value: "rainy", label: "Rainy", icon: "🌧️" },
      { value: "windy", label: "Windy", icon: "💨" },
    ],
  },
  {
    id: "party_size",
    title: "Who is this for?",
    subtitle: "So we can suggest the right portions",
    options: [
      { value: "just_me", label: "Just Me", icon: "👤" },
      { value: "couple", label: "Me & Partner", icon: "👫" },
      { value: "family", label: "Family (3-5)", icon: "👨‍👩‍👧‍👦" },
      { value: "group", label: "Group (6+)", icon: "👥" },
    ],
  },
];

export default function ChefZimDialog({ isOpen, onClose, onRecommendationsReceived }: ChefZimDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleSelectOption = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = async () => {
    if (!answers[currentQuestion.id]) {
      toast({
        title: "Please select an option",
        description: "Choose what best describes you",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      await submitAnswers();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const submitAnswers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/restaurants/ai/recommendations/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(answers),
      });

      const data = await response.json();

      if (data.success) {
        onRecommendationsReceived(data);
        resetDialog();
        onClose();
      } else {
        toast({
          title: "Recommendation Error",
          description: data.error || "Failed to get recommendations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI recommendation error:", error);
      toast({
        title: "Error",
        description: "Failed to get AI recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setCurrentStep(0);
    setAnswers({});
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="text-orange-500 font-semibold">Chef Zim</span>
          </div>
          <DialogTitle className="text-2xl">{currentQuestion.title}</DialogTitle>
          <p className="text-muted-foreground">{currentQuestion.subtitle}</p>
        </DialogHeader>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {currentQuestion.options.map((option) => (
            <Card
              key={option.value}
              className={`cursor-pointer transition-all hover:border-orange-500 ${
                answers[currentQuestion.id] === option.value
                  ? "border-2 border-orange-500 bg-orange-50"
                  : "border"
              }`}
              onClick={() => handleSelectOption(option.value)}
            >
              <CardContent className="p-4 text-center">
                <span className="text-2xl mb-2 block">{option.icon}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 || isLoading}>
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isLoading || !answers[currentQuestion.id]}
            className="bg-orange-500 hover:bg-orange-600 flex-1"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Getting Recommendations...
              </>
            ) : currentStep === questions.length - 1 ? (
              "Get Recommendations"
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
