import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, max_tokens = 1000, temperature = 0.3 } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    // Get AI settings from localStorage (we'll use environment variables in production)
    // For now, we'll call the backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const response = await fetch(`${apiUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          max_tokens,
          temperature
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return NextResponse.json({ response: result.response || result.text || '' });
      } else {
        console.error('Backend AI API failed:', await response.text());
        // Fall back to mock response
        return generateMockAIResponse(prompt);
      }
    } catch (fetchError) {
      console.error('Failed to reach backend AI API:', fetchError);
      // Fall back to mock response
      return generateMockAIResponse(prompt);
    }

  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze with AI' },
      { status: 500 }
    );
  }
}

function generateMockAIResponse(prompt: string) {
  // Generic mock response - in production this should call a real AI service
  // For now, return empty suggestions to force fallback to the generateFallbackSuggestions function
  const response = JSON.stringify({
    suggestions: []
  });

  return NextResponse.json({ response });
}
